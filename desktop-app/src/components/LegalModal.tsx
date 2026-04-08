import React from 'react';
import { X, ShieldCheck, Scale, Globe, Link as LinkIcon, BookOpen, AlertTriangle } from 'lucide-react';
import { Translation } from '../types';

interface LegalModalProps {
    isOpen: boolean;
    onClose: () => void;
    t: Translation;
    language: 'ko' | 'en';
}

export const LegalModal: React.FC<LegalModalProps> = ({ isOpen, onClose, t, language }) => {
    if (!isOpen) return null;

    const isKorean = language === 'ko';

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 shadow-2xl backdrop-blur-sm animate-in fade-in duration-200">
            <div className="relative w-full max-w-2xl max-h-[85vh] bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden flex flex-col border border-gray-100 dark:border-slate-800 animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50">
                    <div className="flex items-center gap-2">
                        <ShieldCheck className="text-primary-500" size={20} />
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white uppercase tracking-tighter">
                            {t.legal}
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-full transition-colors text-gray-500 dark:text-slate-400"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-8 pt-6 space-y-6 no-scrollbar text-sm leading-relaxed">

                    {isKorean ? (
                        /* KR Content */
                        <>
                            <section className="space-y-6">
                                <div className="space-y-2">
                                    <h4 className="flex items-center gap-2 font-bold text-gray-900 dark:text-white">
                                        <BookOpen size={16} className="text-primary-500" /> 제 1 조 (목적 및 서비스 정의)
                                    </h4>
                                    <p className="text-gray-600 dark:text-slate-400 text-xs pl-6">
                                        본 소프트웨어(이하 "Velo")는 <b>Smileon Labs</b>(연락처: contact@smileon.app)에서 제공하며, 사용자의 로컬 환경에서 동영상을 효율적으로 압축하기 위한 도구입니다. 본 소프트웨어는 GNU GPL v3 라이선스를 따르는 오픈소스 프로젝트입니다.
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    <h4 className="flex items-center gap-2 font-bold text-gray-900 dark:text-white">
                                        <Globe size={16} className="text-blue-500" /> 제 2 조 (데이터 처리 및 개인정보 보호)
                                    </h4>
                                    <p className="text-gray-600 dark:text-slate-400 text-xs pl-6">
                                        Velo는 <b>100% 오프라인 처리</b>를 기본 원칙으로 합니다. <br />
                                        1. 사용자의 영상 데이터, 메타데이터 및 개인정보는 외부 서버로 전송되지 않습니다. <br />
                                        2. 라이선스 유효성 확인을 위한 최소한의 통신 이외에 어떠한 인터넷 서버와도 연결되지 않습니다.
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    <h4 className="flex items-center gap-2 font-bold text-red-500">
                                        <AlertTriangle size={16} /> 제 3 조 (책임의 한계 및 면책)
                                    </h4>
                                    <div className="bg-red-50 dark:bg-red-900/10 p-4 rounded-xl border border-red-100 dark:border-red-900/20 space-y-2">
                                        <p className="text-red-700 dark:text-red-400 text-xs font-bold font-sans">
                                            [경고: 데이터 유실 주의]
                                        </p>
                                        <p className="text-gray-600 dark:text-slate-400 text-[11px] leading-normal">
                                            - Velo는 "있는 그대로" 제공되며, 압축 과정 중 발생할 수 있는 원본 파일의 훼손, 손실, 하드웨어 고장에 대하여 <b>Smileon Labs는 어떠한 법적/금전적 책임도 지지 않습니다.</b> <br />
                                            - 특히 '휴지통 이동' 기능 사용 시 발생하는 데이터 삭제 및 복구 불가능성에 대한 책임은 전적으로 사용자에게 있습니다. <br />
                                            - <b>오프라인 처리의 특성상, 개발자는 사용자의 유실된 자료를 복구해 줄 어떠한 기술적 수단이나 의무도 가지고 있지 않습니다.</b>
                                        </p>
                                    </div>
                                </div>

                                <div className="space-y-2 pt-4 border-t border-gray-100 dark:border-slate-800 text-[10px] text-gray-400">
                                    <p className="flex items-center gap-1.5 mb-1">
                                        <LinkIcon size={12} />
                                        GitHub: <a href="https://github.com/SmileonLabs/Velo" target="_blank" rel="noopener noreferrer" className="text-primary-500 hover:underline">https://github.com/SmileonLabs/Velo</a>
                                    </p>
                                    <p>공식 사이트: velo.smileon.app</p>
                                    <p>© 2026 Smileon Labs. All rights reserved.</p>
                                </div>
                            </section>
                        </>
                    ) : (
                        /* EN Content */
                        <>
                            <section className="space-y-6">
                                <div className="space-y-2">
                                    <h4 className="font-bold text-gray-900 dark:text-white">Article 1 (Service Definition)</h4>
                                    <p className="text-gray-500 dark:text-slate-400 text-xs pl-6">
                                        Velo is an open-source tool provided by <b>Smileon Labs</b> (contact@smileon.app) for local video compression. This project is distributed under the GNU GPL v3 license.
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    <h4 className="font-bold text-gray-900 dark:text-white">Article 2 (Data Privacy & Connectivity)</h4>
                                    <p className="text-gray-500 dark:text-slate-400 text-xs pl-6">
                                        Velo operates 100% offline. <br />
                                        1. No video data or metadata is ever transmitted to our servers. <br />
                                        2. Except for license validation, the software never connects to the internet.
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    <h4 className="font-bold text-red-500">Article 3 (Limitation of Liability)</h4>
                                    <div className="bg-red-50 dark:bg-red-900/10 p-4 rounded-xl border border-red-100 dark:border-red-900/20">
                                        <p className="text-red-700 dark:text-red-400 text-[10px] uppercase font-black mb-1">Mandatory Disclaimer</p>
                                        <p className="text-gray-500 dark:text-slate-400 text-[11px] font-medium leading-normal">
                                            - THIS SOFTWARE IS PROVIDED "AS IS." Smileon Labs shall not be liable for any data loss, file corruption, or system failure arising from the use of this software. <br />
                                            - Smileon Labs possesses NO technical capability to recover any lost or corrupted user data due to the inherent offline nature of the application.
                                        </p>
                                    </div>
                                </div>

                                <div className="pt-4 border-t border-gray-100 dark:border-slate-800 text-[10px] text-gray-400">
                                    <p className="flex items-center gap-1.5 mb-1">
                                        <LinkIcon size={12} />
                                        GitHub: <a href="https://github.com/SmileonLabs/Velo" target="_blank" rel="noopener noreferrer" className="text-primary-500 hover:underline">https://github.com/SmileonLabs/Velo</a>
                                    </p>
                                    <p>Official Website: velo.smileon.app</p>
                                    <p>© 2026 Smileon Labs. All rights reserved.</p>
                                </div>
                            </section>
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 bg-gray-50 dark:bg-slate-800/30 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-6 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-2xl font-bold text-sm hover:scale-105 active:scale-95 transition-all shadow-lg"
                    >
                        {isKorean ? "내용을 이해했습니다" : "I UNDERSTAND"}
                    </button>
                </div>
            </div>
        </div>
    );
};
