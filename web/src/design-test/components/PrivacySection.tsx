import React from 'react';
import { Shield, HardDrive, WifiOff, CheckCircle } from 'lucide-react';
import GlassCard from './ui/GlassCard';

const PrivacySection: React.FC = () => {
    return (
        <section id="privacy" className="py-24 bg-darker relative">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="grid lg:grid-cols-2 gap-16 items-center">

                    {/* Content */}
                    <div className="order-2 lg:order-1">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-black uppercase tracking-[0.2em] mb-6">
                            <Shield className="w-3 h-3" /> Enterprise Grade Security
                        </div>
                        <h2 className="text-3xl md:text-5xl font-black text-white mb-6 uppercase tracking-tighter">
                            What happens on your Mac,<br />
                            <span className="text-primary">stays on your Mac.</span>
                        </h2>
                        <p className="text-lg text-slate-400 mb-8 font-medium leading-relaxed">
                            We believe video compression shouldn't require uploading gigabytes of sensitive footage to a random cloud server. Velo runs 100% offline.
                        </p>

                        <div className="grid gap-4">
                            {[
                                { title: 'Zero Data Upload', desc: 'No files are ever sent to the cloud.', icon: WifiOff },
                                { title: 'Local Processing', desc: 'Uses your CPU/GPU for maximum speed.', icon: HardDrive },
                                { title: 'GDPR Compliant', desc: 'Naturally compliant by design.', icon: CheckCircle },
                            ].map((item, idx) => (
                                <GlassCard key={idx} className="flex items-center gap-4 py-4 px-6 hover:bg-white/5 border-white/5">
                                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                                        <item.icon className="w-5 h-5 text-primary" />
                                    </div>
                                    <div>
                                        <h4 className="text-white font-bold text-sm uppercase tracking-wide">{item.title}</h4>
                                        <p className="text-xs text-slate-500 mt-0.5">{item.desc}</p>
                                    </div>
                                </GlassCard>
                            ))}
                        </div>
                    </div>

                    {/* Abstract Security Visual */}
                    <div className="order-1 lg:order-2 flex justify-center">
                        <div className="relative w-full max-w-md aspect-square flex items-center justify-center">
                            {/* Outer Glow Ring */}
                            <div className="absolute inset-0 border border-primary/20 rounded-full animate-[spin_10s_linear_infinite]" />
                            <div className="absolute inset-4 border border-primary/10 rounded-full animate-[spin_15s_linear_infinite_reverse]" />

                            {/* Shield Icon Central */}
                            <div className="relative w-48 h-48 bg-gradient-to-b from-surface to-darker rounded-3xl border border-white/10 flex items-center justify-center shadow-[0_0_50px_rgba(139,92,246,0.15)] z-10">
                                <Shield className="w-20 h-20 text-primary drop-shadow-[0_0_15px_rgba(139,92,246,0.5)]" />

                                {/* Lock Badge */}
                                <div className="absolute -bottom-4 -right-4 w-16 h-16 bg-darker border border-white/10 rounded-2xl flex items-center justify-center shadow-xl">
                                    <HardDrive className="w-8 h-8 text-slate-300" />
                                </div>
                            </div>

                            {/* Particle Field */}
                            <div className="absolute inset-0 z-0">
                                <div className="absolute top-10 left-20 w-1 h-1 bg-primary rounded-full animate-pulse" />
                                <div className="absolute bottom-20 right-10 w-2 h-2 bg-purple-400 rounded-full animate-pulse" style={{ animationDelay: '1s' }} />
                                <div className="absolute top-1/2 left-10 w-1 h-1 bg-white/30 rounded-full animate-ping" />
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </section>
    );
};

export default PrivacySection;
