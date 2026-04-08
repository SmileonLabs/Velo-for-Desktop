import type { NavItem, Feature, Preset } from './types';

export const NAV_ITEMS: NavItem[] = [
    { label: 'Features', href: '#features' },
    { label: 'Technology', href: '#technology' },
    { label: 'Interface', href: '#interface' },
    { label: 'Privacy', href: '#privacy' },
];

export const FEATURES: Feature[] = [
    {
        id: 'perceptual',
        title: 'Perceptual Optimization',
        description: 'Focuses bitrate on human visual focus areas—faces and subtitles—saving up to 30% more space.',
        iconName: 'Wand2',
    },
    {
        id: 'hdr',
        title: '10-bit HDR Preservation',
        description: 'Naturally preserves iPhone & Galaxy HDR10+ colors and depth without heavy banding or fading.',
        iconName: 'Sparkles',
    },
    {
        id: 'presets',
        title: '3-Step Golden Presets',
        description: 'Expertly tuned quality levels from Archival (Level 4) to Maximum Compression (Level 8).',
        iconName: 'Zap',
    },
    {
        id: 'cleaning',
        title: 'Metadata Cleaning',
        description: 'Protect your privacy by stripping GPS, device IDs, and sensitive metadata during processing.',
        iconName: 'ShieldCheck',
    },
];

export const PRESETS: Preset[] = [
    { id: 'hq', label: 'High Quality', subLabel: 'Best for archiving' },
    { id: 'balanced', label: 'Balanced', subLabel: 'Recommended', active: true },
    { id: 'small', label: 'Small Size', subLabel: 'Web & Mobile' },
];

export const PROMPTS = {
    hero: "A high-end landing page hero section for a desktop app named 'Velo'. Featuring a sleek, minimalist 3D workstation setup with a modern laptop showing a video optimization dashboard.",
    coreTech: "Abstract visual representation of 'Perceptual Quality Optimization'. A split-screen comparison of a video frame; the left side is heavy and pixelated, the right side is crystal clear.",
    interface: "UI/UX design of a desktop video compressor app. Modern Glassmorphism style, translucent panels, clean typography.",
    privacy: "Conceptual icon/graphic for 'Local Offline Processing'. A stylized shield integrated with a hard drive icon.",
};
