import React from 'react';
import Button from './ui/Button';
import { ArrowRight, Play } from 'lucide-react';

const Hero: React.FC = () => {
    return (
        <section className="relative min-h-screen flex items-center pt-20 overflow-hidden">

            {/* Background Elements */}
            <div className="absolute inset-0 z-0">
                {/* Abstract Glows */}
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/25 rounded-full blur-[128px] animate-pulse-slow" />
                <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[128px] animate-pulse-slow" style={{ animationDelay: '2s' }} />

                {/* Grid Pattern */}
                <div
                    className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px]"
                    style={{ maskImage: 'linear-gradient(to bottom, black 40%, transparent 100%)' }}
                />
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 w-full grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">

                {/* Text Content */}
                <div className="space-y-8 text-center lg:text-left">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm">
                        <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                        <span className="text-xs font-bold text-slate-300 uppercase tracking-widest">v2.1 Now Available</span>
                    </div>

                    <h1 className="text-5xl lg:text-8xl font-black tracking-tighter text-white leading-[1] uppercase">
                        VELO <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-purple-400 to-indigo-500">
                            PRO DESKTOP
                        </span>
                    </h1>

                    <p className="text-lg text-slate-400 max-w-xl mx-auto lg:mx-0 leading-relaxed">
                        The ultimate desktop tool for creators. Reduce file size by up to 80% without losing perceptual quality.
                        Powered by next-gen AI compression.
                    </p>

                    <div className="flex flex-col sm:flex-row items-center gap-4 justify-center lg:justify-start">
                        <Button size="lg" className="group">
                            Download for Mac
                            <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                        </Button>
                        <Button size="lg" variant="glass" className="group">
                            <Play className="w-5 h-5 mr-2 fill-white" />
                            Watch Demo
                        </Button>
                    </div>

                    <div className="pt-4 flex items-center justify-center lg:justify-start gap-6 text-sm text-slate-500 font-medium">
                        <span>macOS 12+</span>
                        <span>Windows 11</span>
                        <span>Linux</span>
                    </div>
                </div>

                {/* Visual Content - 3D Workstation Placeholder */}
                <div className="relative lg:h-[600px] flex items-center justify-center animate-float">
                    {/* Main glowing container representing the workstation */}
                    <div className="relative w-full aspect-[4/3] max-w-lg mx-auto">
                        {/* Decorative glow behind image */}
                        <div className="absolute inset-0 bg-gradient-to-tr from-primary to-purple-800 blur-2xl opacity-40 -z-10 rounded-3xl" />

                        {/* The "Laptop/Screen" Image */}
                        <div className="relative w-full h-full rounded-2xl overflow-hidden border border-white/10 shadow-2xl bg-darker">
                            <img
                                src="https://picsum.photos/800/600?random=1"
                                alt="Velo Dashboard Interface"
                                className="w-full h-full object-cover opacity-60 hover:scale-105 transition-transform duration-700"
                            />

                            {/* Overlay UI elements to mimic dashboard */}
                            <div className="absolute inset-0 bg-gradient-to-t from-darker via-transparent to-transparent opacity-90" />
                            <div className="absolute bottom-8 left-8 right-8 p-6 bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl">
                                <div className="flex justify-between items-center mb-2">
                                    <div className="text-xs font-bold text-slate-300 uppercase tracking-widest">Processing...</div>
                                    <div className="text-sm font-mono text-primary font-bold">85%</div>
                                </div>
                                <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                                    <div className="h-full bg-primary w-[85%] rounded-full shadow-[0_0_10px_rgba(139,92,246,0.5)]" />
                                </div>
                            </div>
                        </div>

                        {/* Floating Elements (Feathers/Data) */}
                        <div className="absolute -right-8 -top-8 p-4 bg-surface/80 backdrop-blur-lg border border-white/10 rounded-2xl shadow-xl animate-bounce" style={{ animationDuration: '3s' }}>
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                                    ↓
                                </div>
                                <div>
                                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Size Saved</div>
                                    <div className="text-xl font-black text-white">-3.4 GB</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default Hero;
