import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Shield, ArrowLeft, Globe } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';
import SEO from '../components/SEO';

const PrivacyPolicy = () => {
    const { t, i18n } = useTranslation();
    const { theme } = useTheme();
    const isKo = i18n.language.startsWith('ko');

    const changeLanguage = (lng: string) => {
        i18n.changeLanguage(lng);
    };

    return (
        <div className={`min-h-screen ${theme === 'dark' ? 'bg-[#0a0a0f] text-white' : 'bg-white text-slate-900'}`}>
            <SEO
                title={isKo ? '개인정보 처리방침 | Velo' : 'Privacy Policy | Velo'}
                description={isKo ? 'Velo 개인정보 처리방침' : 'Velo Privacy Policy'}
            />

            {/* Header */}
            <header className={`sticky top-0 z-50 backdrop-blur-xl border-b ${theme === 'dark' ? 'bg-[#0a0a0f]/80 border-white/10' : 'bg-white/80 border-slate-200'}`}>
                <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
                    <Link to="/" className="flex items-center gap-2 text-sm font-medium opacity-60 hover:opacity-100 transition-opacity">
                        <ArrowLeft size={16} />
                        {isKo ? '홈으로' : 'Back to Home'}
                    </Link>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => changeLanguage(isKo ? 'en' : 'ko')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${theme === 'dark' ? 'bg-white/10 hover:bg-white/20' : 'bg-slate-100 hover:bg-slate-200'}`}
                        >
                            <Globe size={12} />
                            {isKo ? 'EN' : '한국어'}
                        </button>
                    </div>
                </div>
            </header>

            {/* Content */}
            <main className="max-w-4xl mx-auto px-6 py-16">
                {/* Title */}
                <div className="mb-12">
                    <div className="flex items-center gap-3 mb-4">
                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${theme === 'dark' ? 'bg-indigo-500/20' : 'bg-indigo-50'}`}>
                            <Shield className="w-5 h-5 text-indigo-500" />
                        </div>
                        <h1 className="text-3xl font-black tracking-tight">
                            {t('legal.privacy_title')}
                        </h1>
                    </div>
                    <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                        {isKo ? '최종 업데이트: 2026년 3월 9일' : 'Last updated: March 9, 2026'}
                    </p>
                </div>

                {/* Intro */}
                <div className={`p-6 rounded-3xl mb-8 ${theme === 'dark' ? 'bg-indigo-500/10 border border-indigo-500/20' : 'bg-indigo-50 border border-indigo-100'}`}>
                    <p className="text-base font-semibold leading-relaxed">
                        {t('legal.privacy_intro')}
                    </p>
                </div>

                <div className="space-y-8">
                    {/* Section 1: Personal & Payment Info */}
                    <section className={`p-8 rounded-3xl ${theme === 'dark' ? 'bg-white/5 border border-white/10' : 'bg-slate-50 border border-slate-100'}`}>
                        <h2 className="text-xl font-black mb-4">
                            {t('legal.privacy_sec1_title')}
                        </h2>
                        <ul className="space-y-3">
                            <li className="flex items-start gap-3">
                                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-2.5 shrink-0" />
                                <span className={`leading-relaxed ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>
                                    {t('legal.privacy_sec1_item1')}
                                </span>
                            </li>
                            <li className="flex items-start gap-3">
                                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-2.5 shrink-0" />
                                <span className={`leading-relaxed ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>
                                    {t('legal.privacy_sec1_item2')}
                                </span>
                            </li>
                        </ul>
                    </section>

                    {/* Section 2: Video File Protection */}
                    <section className={`p-8 rounded-3xl ${theme === 'dark' ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-emerald-50 border border-emerald-100'}`}>
                        <h2 className="text-xl font-black mb-4">
                            {t('legal.privacy_sec2_title')}
                        </h2>
                        <p className={`font-bold text-lg mb-2 ${theme === 'dark' ? 'text-emerald-400' : 'text-emerald-700'}`}>
                            {t('legal.privacy_sec2_desc1')}
                        </p>
                        <p className={`leading-relaxed ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>
                            {t('legal.privacy_sec2_desc2')}
                        </p>
                    </section>

                    {/* Section 3: Data Retention */}
                    <section className={`p-8 rounded-3xl ${theme === 'dark' ? 'bg-white/5 border border-white/10' : 'bg-slate-50 border border-slate-100'}`}>
                        <h2 className="text-xl font-black mb-4">
                            {t('legal.privacy_sec3_title')}
                        </h2>
                        <p className={`leading-relaxed ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>
                            {t('legal.privacy_sec3_desc')}
                        </p>
                    </section>

                    {/* Additional sections for completeness */}
                    <section className={`p-8 rounded-3xl ${theme === 'dark' ? 'bg-white/5 border border-white/10' : 'bg-slate-50 border border-slate-100'}`}>
                        <h2 className="text-xl font-black mb-4">
                            {isKo ? '4. 쿠키 및 추적 기술' : '4. Cookies & Tracking'}
                        </h2>
                        <p className={`leading-relaxed ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>
                            {isKo
                                ? 'Velo 데스크탑 앱은 쿠키를 사용하지 않습니다. 웹사이트는 서비스 개선을 위해 익명화된 방문 통계를 수집할 수 있으나, 이는 개인 식별이 불가능한 정보입니다.'
                                : 'The Velo desktop app does not use cookies. Our website may collect anonymized visit statistics for service improvement, which cannot be used to identify individuals.'
                            }
                        </p>
                    </section>

                    <section className={`p-8 rounded-3xl ${theme === 'dark' ? 'bg-white/5 border border-white/10' : 'bg-slate-50 border border-slate-100'}`}>
                        <h2 className="text-xl font-black mb-4">
                            {isKo ? '5. 제3자 제공' : '5. Third-Party Sharing'}
                        </h2>
                        <p className={`leading-relaxed ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>
                            {isKo
                                ? '당사는 결제 처리(Polar/Stripe)를 제외하고 사용자의 개인정보를 제3자에게 제공하지 않습니다. 결제 파트너사는 자체 개인정보 처리방침에 따라 결제 정보를 처리합니다.'
                                : 'We do not share your personal information with third parties except for payment processing (Polar/Stripe). Our payment partners process payment information under their own privacy policies.'
                            }
                        </p>
                    </section>

                    <section className={`p-8 rounded-3xl ${theme === 'dark' ? 'bg-white/5 border border-white/10' : 'bg-slate-50 border border-slate-100'}`}>
                        <h2 className="text-xl font-black mb-4">
                            {isKo ? '6. 사용자의 권리' : '6. Your Rights'}
                        </h2>
                        <p className={`leading-relaxed ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>
                            {isKo
                                ? '사용자는 언제든지 자신의 개인정보에 대해 열람, 정정, 삭제를 요청할 수 있습니다. 계정 삭제 요청 시 관련된 모든 개인정보가 안전하게 파기됩니다. 문의: contact@smileon.app'
                                : 'You may request access to, correction of, or deletion of your personal information at any time. When you request account deletion, all associated personal data will be securely destroyed. Contact: contact@smileon.app'
                            }
                        </p>
                    </section>

                    <section className={`p-8 rounded-3xl ${theme === 'dark' ? 'bg-white/5 border border-white/10' : 'bg-slate-50 border border-slate-100'}`}>
                        <h2 className="text-xl font-black mb-4">
                            {isKo ? '7. 방침 변경 안내' : '7. Changes to This Policy'}
                        </h2>
                        <p className={`leading-relaxed ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>
                            {isKo
                                ? '본 개인정보 처리방침은 관련 법령 변경 또는 서비스 운영 정책에 따라 변경될 수 있으며, 변경 시 본 페이지를 통해 공지합니다.'
                                : 'This privacy policy may be updated in accordance with changes in applicable laws or service policies. Any changes will be posted on this page.'
                            }
                        </p>
                    </section>
                </div>

                {/* Contact */}
                <div className={`mt-12 p-8 rounded-3xl text-center ${theme === 'dark' ? 'bg-white/5 border border-white/10' : 'bg-slate-50 border border-slate-100'}`}>
                    <p className={`text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                        {isKo ? '개인정보 관련 문의' : 'Privacy Inquiries'}
                    </p>
                    <a href="mailto:contact@smileon.app" className="text-indigo-500 font-bold hover:underline">
                        contact@smileon.app
                    </a>
                    <p className={`text-xs mt-4 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
                        © 2026 Smileon Labs. All rights reserved.
                    </p>
                </div>
            </main>
        </div>
    );
};

export default PrivacyPolicy;
