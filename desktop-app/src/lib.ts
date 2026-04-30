import { Command, Child } from '@tauri-apps/plugin-shell';
import { readFile } from '@tauri-apps/plugin-fs';
import { invoke } from '@tauri-apps/api/core';
import { CompressionSettings } from './types';

export interface FFmpegProgress {
    percent: number;
    time: string;
    fps: number;
    speed: string;
}

export type ProgressCallback = (progress: FFmpegProgress) => void;

function toDataUrl(bytes: Uint8Array, mimeType: string): string {
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, i + chunkSize);
        binary += String.fromCharCode(...chunk);
    }
    return `data:${mimeType};base64,${btoa(binary)}`;
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
    const base64 = dataUrl.split(',')[1] || '';
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

function getMimeForInput(path: string): string {
    const ext = path.split('.').pop()?.toLowerCase() || '';
    if (ext === 'png') return 'image/png';
    if (ext === 'webp') return 'image/webp';
    if (ext === 'gif') return 'image/gif';
    if (ext === 'bmp') return 'image/bmp';
    return 'image/jpeg';
}

function getMimeForOutput(format: 'JPG' | 'PNG' | 'WEBP' | 'AVIF'): string {
    if (format === 'PNG') return 'image/png';
    if (format === 'WEBP') return 'image/webp';
    if (format === 'AVIF') return 'image/avif';
    return 'image/jpeg';
}

export function compressImage(
    inputPath: string,
    outputPath: string,
    format: 'JPG' | 'PNG' | 'WEBP' | 'AVIF',
    quality: number,
    onProgress?: ProgressCallback,
    lossless: boolean = false
): { promise: Promise<void>, stop: () => Promise<void> } {
    // 무손실 모드 — JPG/WEBP는 본질적으로 손실. PNG로 자동 전환 (Canvas가 PNG는 무손실 처리).
    // AVIF는 무손실 모드에서 CRF=0 사용 (FFmpeg 경로).
    let effectiveFormat = format;
    if (lossless && (format === 'JPG' || format === 'WEBP')) {
        effectiveFormat = 'PNG';
    }

    // AVIF는 Canvas API가 지원 안 함 → FFmpeg 경로로 분기
    if (effectiveFormat === 'AVIF') {
        return compressToAvifWithProgress(inputPath, outputPath, quality, onProgress, lossless);
    }

    const run = async () => {
        const sourceBytes = await readFile(inputPath);
        const sourceDataUrl = toDataUrl(sourceBytes, getMimeForInput(inputPath));

        const img = new Image();
        const loaded = new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => reject(new Error('Failed to load image'));
        });
        img.src = sourceDataUrl;
        await loaded;

        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
            throw new Error('Failed to create canvas context');
        }

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const outputMime = getMimeForOutput(effectiveFormat);
        // PNG는 quality 파라미터 무시하고 항상 무손실. JPG/WEBP에서만 quality 적용.
        const normalizedQuality = Math.max(0.01, Math.min(1, quality / 100));
        const outputDataUrl = canvas.toDataURL(outputMime, normalizedQuality);
        const outputBytes = dataUrlToBytes(outputDataUrl);

        await invoke('write_binary_file', {
            path: outputPath,
            bytes: Array.from(outputBytes),
        });
        if (onProgress) onProgress({ percent: 100, time: '', fps: 0, speed: '' });
    };

    return {
        promise: run(),
        stop: async () => {
            return;
        }
    };
}

/// AVIF 인코딩. lossless=true면 CRF=0 (픽셀 100% 동일), false면 quality 기반 손실 압축.
function compressToAvifWithProgress(
    inputPath: string,
    outputPath: string,
    quality: number,
    onProgress?: ProgressCallback,
    lossless: boolean = false
): { promise: Promise<void>, stop: () => Promise<void> } {
    let child: Child | null = null;

    const run = async () => {
        const normalized = Math.max(1, Math.min(100, quality));
        // AV1 CRF: lossless=true → 0 (무손실). 아니면 quality 100→18, 50→34, 1→50.
        const crf = lossless ? 0 : Math.round(50 - (normalized * 32 / 100));

        const ffmpegArgs = [
            '-y',
            '-i', inputPath,
            '-c:v', 'libsvtav1',
            '-crf', String(crf),
            '-still-picture', '1',
        ];
        // 무손실 모드는 yuv444p (full chroma) 권장 — 색 정보 손실 없게.
        // 손실 모드는 yuv420p로 더 작은 파일.
        ffmpegArgs.push('-pix_fmt', lossless ? 'yuv444p' : 'yuv420p');
        ffmpegArgs.push(outputPath);

        const command = Command.sidecar('binaries/ffmpeg', ffmpegArgs);

        const exitCode = await new Promise<number>((resolve, reject) => {
            command.on('close', (data) => resolve(data.code ?? -1));
            command.on('error', (err) => reject(new Error(err)));
            command.spawn().then((c) => { child = c; }).catch(reject);
        });

        if (exitCode !== 0) {
            throw new Error(`AVIF 인코딩 실패 (exit ${exitCode})`);
        }
        if (onProgress) onProgress({ percent: 100, time: '', fps: 0, speed: '' });
    };

    return {
        promise: run(),
        stop: async () => {
            await child?.kill();
        }
    };
}

/**
 * Checks for available hardware acceleration for AV1 encoding.
 * Priority: libsvtav1 (best SW) > HW encoders (platform-specific) > libaom-av1 (fallback)
 *
 * Platform notes:
 *   - Windows: av1_nvenc (NVIDIA), av1_qsv (Intel), av1_amf (AMD)
 *   - macOS:   av1_videotoolbox (Apple Silicon, macOS 14+)
 *   - Linux:   av1_nvenc, av1_qsv, av1_vaapi
 */
export async function getBestAV1Encoder(): Promise<string> {
    try {
        const command = Command.sidecar('binaries/ffmpeg', ['-encoders']);
        const output = await command.execute();
        if (output.code !== 0) return 'libaom-av1';

        const stdout = output.stdout;
        if (stdout.includes('libsvtav1')) return 'libsvtav1';
        // Hardware acceleration (cross-platform)
        if (stdout.includes('av1_videotoolbox')) return 'av1_videotoolbox'; // macOS Apple Silicon
        if (stdout.includes('av1_nvenc')) return 'av1_nvenc';               // NVIDIA (Windows/Linux)
        if (stdout.includes('av1_qsv')) return 'av1_qsv';                  // Intel Quick Sync
        if (stdout.includes('av1_amf')) return 'av1_amf';                   // AMD (Windows)
        if (stdout.includes('av1_vaapi')) return 'av1_vaapi';               // Linux VA-API
        return 'libaom-av1';
    } catch (error) {
        return 'libaom-av1';
    }
}

/**
 * Gets file metadata (size) using ffprobe sidecar.
 */
export async function getFileInfo(path: string): Promise<{ size: number }> {
    try {
        const command = Command.sidecar('binaries/ffprobe', [
            '-v', 'error',
            '-show_entries', 'format=size',
            '-of', 'default=noprint_wrappers=1:nokey=1',
            path
        ]);
        const output = await command.execute();
        return { size: parseInt(output.stdout.trim()) || 0 };
    } catch (error) {
        return { size: 0 };
    }
}

async function getVideoDuration(inputPath: string): Promise<number> {
    const command = Command.sidecar('binaries/ffprobe', [
        '-v', 'error',
        '-show_entries', 'format=duration',
        '-of', 'default=noprint_wrappers=1:nokey=1',
        inputPath
    ]);
    const output = await command.execute();
    return parseFloat(output.stdout.trim());
}

/**
 * Main compression logic. Returns a promise and a stop function.
 */
export function compressVideo(
    inputPath: string,
    outputPath: string,
    options: CompressionSettings,
    onProgress?: ProgressCallback
): { promise: Promise<void>, stop: () => Promise<void> } {
    let childProcess: Child | null = null;

    const run = async () => {
        const duration = await getVideoDuration(inputPath).catch(() => 0);
        const encoder = await getBestAV1Encoder();

        const args = ['-i', inputPath];

        // 1. Output Format & Encoder
        if (options.format === 'GIF') {
            args.push('-vf', 'fps=15,scale=-1:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse');
        } else {
            // Priority: Hardware Encoder (if Turbo) > Specified Codec > Software
            let finalEncoder = 'libaom-av1';
            // 'AV1' 포맷 선택 시 코덱 강제 — 토글(useHighEfficiencyCodec)과 무관하게 무조건 AV1.
            const forceAV1 = options.format === 'AV1';

            if (options.useHighEfficiencyCodec || forceAV1) {
                // === AV1 Mode (High Efficiency) ===
                finalEncoder = encoder; // Default to best detected AV1 encoder

                if (options.enableTurbo) {
                    if (encoder.includes('nvenc') || encoder.includes('qsv') || encoder.includes('amf')) {
                        finalEncoder = encoder;
                    }
                }

                args.push('-c:v', finalEncoder);

                // Quality Mapping (1 to 10 Gauge)
                const crfValue = 18 + (options.compressionLevel - 1) * 3.5;

                if (finalEncoder === 'libsvtav1') {
                    args.push('-crf', Math.round(crfValue).toString());
                    args.push('-preset', options.enableTurbo ? '10' : '6');

                    const svtParams: string[] = [];
                    if (options.subjectiveVQ) svtParams.push('tune=0');
                    if (options.enableHDR) {
                        args.push('-pix_fmt', 'yuv420p10le');
                        svtParams.push('enable-hdr=1');
                    }
                    if (options.enableTurbo) svtParams.push('tile-columns=2', 'tile-rows=1');

                    if (svtParams.length > 0) args.push('-svtav1-params', svtParams.join(':'));
                } else if (finalEncoder === 'av1_videotoolbox') {
                    // macOS Apple Silicon hardware encoder
                    args.push('-q:v', Math.round(crfValue).toString());
                    if (options.enableTurbo) args.push('-realtime', '1');
                } else if (finalEncoder.includes('nvenc')) {
                    args.push('-rc', 'vbr', '-cq', Math.round(crfValue).toString(), '-preset', options.enableTurbo ? 'p1' : 'p4');
                } else if (finalEncoder === 'av1_vaapi') {
                    // Linux VA-API hardware encoder
                    args.push('-rc_mode', 'CQP', '-qp', Math.round(crfValue).toString());
                } else {
                    // Fallback (likely libaom-av1)
                    args.push('-crf', Math.round(crfValue).toString());
                    args.push('-cpu-used', options.enableTurbo ? '8' : '4');
                }
            } else {
                // === VP9 Mode (Safe Default) ===
                // Uses libvpx-vp9 which is Royalty-Free and widely supported
                finalEncoder = 'libvpx-vp9';

                args.push('-c:v', finalEncoder);

                // VP9 Quality: CRF 0-63. Useful range 15-50.
                const crfValue = 28 + (options.compressionLevel - 1) * 2.5;

                args.push('-b:v', '0'); // Constrained Quality mode
                args.push('-crf', Math.round(crfValue).toString());

                // Speed Optimization: Realtime mode is much faster
                args.push('-deadline', 'realtime');

                // Speed vs Quality trade-off
                // -cpu-used: 0-8 for realtime. 8 is fastest.
                // We use 5-8 range for decent speed
                args.push('-cpu-used', options.enableTurbo ? '8' : '5');

                args.push('-row-mt', '1'); // Multi-threading
            }

            // Global Thread Optimization
            if (options.enableTurbo) {
                args.push('-threads', '0');
            }
        }

        // 2. Filter Chain
        const filters: string[] = [];
        if (options.enableDeshake) filters.push('deshake');

        // Watermark Logic
        if (options.enableWatermark) {
            const text = options.watermarkText || 'Velo';
            // Simple overlay at bottom-right
            filters.push(`drawtext=text='${text}':x=w-tw-20:y=h-th-20:fontsize=24:fontcolor=white@0.5:shadowcolor=black:shadowx=2:shadowy=2`);
        }

        switch (options.resolution) {
            case '4K': filters.push('scale=3840:-2'); break;
            case '1080p': filters.push('scale=1920:-2'); break;
            case '720p': filters.push('scale=1280:-2'); break;
            case '480p': filters.push('scale=854:-2'); break;
            case 'Instagram': filters.push('scale=1080:1080:force_original_aspect_ratio=increase,crop=1080:1080'); break;
            case 'YouTube': filters.push('scale=3840:-2'); break;
            case 'Custom':
                if (options.customWidth && options.customHeight) {
                    const scalePart = `scale=${options.customWidth}:${options.customHeight}`;
                    if (options.lockAspectRatio) {
                        filters.push(`${scalePart}:force_original_aspect_ratio=decrease,pad=${options.customWidth}:${options.customHeight}:(ow-iw)/2:(oh-ih)/2`);
                    } else {
                        filters.push(scalePart);
                    }
                }
                break;
        }

        if (filters.length > 0 && options.format !== 'GIF') {
            args.push('-vf', filters.join(','));
        }

        // 3. Audio Handling (Fix WebM / AAC conflict)
        if (options.removeAudio || options.format === 'GIF') {
            args.push('-an');
        } else {
            // WebM must use opus or vorbis. We use opus as it's better.
            if (options.format === 'WebM') {
                args.push('-c:a', 'libopus', '-b:a', '128k');
            } else {
                args.push('-c:a', 'aac', '-b:a', '128k');
            }
        }

        // 4. Metadata Cleaning
        if (options.cleanMetadata) {
            args.push('-map_metadata', '-1');
        }

        args.push('-y', outputPath);

        const command = Command.sidecar('binaries/ffmpeg', args);

        command.stderr.on('data', line => {
            const timeMatch = line.match(/time=(\d{2}:\d{2}:\d{2}\.\d{2})/);
            if (timeMatch && onProgress) {
                const [h, m, s] = timeMatch[1].split(':').map(parseFloat);
                const currentTime = h * 3600 + m * 60 + s;
                const percent = duration > 0 ? Math.min((currentTime / duration) * 100, 99.9) : 0;
                onProgress({ percent, time: timeMatch[1], fps: 0, speed: '' });
            }
        });

        return new Promise<void>((resolve, reject) => {
            command.on('close', async data => {
                if (data.code === 0) {
                    // Success! Now handle thumbnail if enabled
                    if (options.enableThumbnail) {
                        try {
                            const thumbPath = outputPath.replace(/\.[^/.]+$/, "") + "_thumb.jpg";
                            const thumbCmd = Command.sidecar('binaries/ffmpeg', [
                                '-ss', '1', // Capture at 1s
                                '-i', inputPath,
                                '-frames:v', '1',
                                '-q:v', '2',
                                '-y', thumbPath
                            ]);
                            await thumbCmd.execute();
                        } catch (thumbErr) {
                            console.error('Thumbnail generation failed:', thumbErr);
                        }
                    }

                    if (onProgress) onProgress({ percent: 100, time: '', fps: 0, speed: '' });
                    resolve();
                } else if (data.code === null) {
                    reject(new Error('STOPPED'));
                } else {
                    reject(new Error(`FFmpeg error ${data.code}`));
                }
            });
            command.spawn().then(c => {
                childProcess = c;
            }).catch(reject);
        });
    };

    return {
        promise: run(),
        stop: async () => {
            if (childProcess) {
                await childProcess.kill();
            }
        }
    };
}
