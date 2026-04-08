import { Link } from 'react-router-dom';
import { Trash2, ArrowLeft, Globe } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';
import SEO from '../components/SEO';
import { useTranslation } from 'react-i18next';

const DeleteAccount = () => {
    const { theme } = useTheme();
    const { i18n } = useTranslation();
    const isKo = i18n.language.startsWith('ko');

    const changeLanguage = (lng: string) => {
        i18n.changeLanguage(lng);
    };

    return (
        <div className={`min-h-screen ${theme === 'dark' ? 'bg-[#0a0a0f] text-white' : 'bg-white text-slate-900'}`}>
            <SEO
                title={isKo ? '계정 삭제 안내 | Velo' : 'Delete Account | Velo'}
                description={isKo ? 'Velo 계정 삭제 방법 안내' : 'How to delete your Velo account'}
                noindex
            />

            {/* Header */}
            <header className={`sticky top-0 z-50 backdrop-blur-xl border-b ${theme === 'dark' ? 'bg-[#0a0a0f]/80 border-white/10' : 'bg-white/80 border-slate-200'}`}>
                <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
                    <Link to="/" className="flex items-center gap-2 text-sm font-medium opacity-60 hover:opacity-100 transition-opacity">
                        <ArrowLeft size={16} />
                        {isKo ? '홈으로' : 'Back to Home'}
                    </Link>
                    <button
                        onClick={() => changeLanguage(isKo ? 'en' : 'ko')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${theme === 'dark' ? 'bg-white/10 hover:bg-white/20' : 'bg-slate-100 hover:bg-slate-200'}`}
                    >
                        <Globe size={12} />
                        {isKo ? 'EN' : '한국어'}
                    </button>
                </div>
            </header>

            {/* Content */}
            <main className="max-w-4xl mx-auto px-6 py-16">
                {/* Title */}
                <div className="mb-12">
                    <div className="flex items-center gap-3 mb-4">
                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${theme === 'dark' ? 'bg-red-500/20' : 'bg-red-50'}`}>
                            <Trash2 className="w-5 h-5 text-red-500" />
                        </div>
                        <h1 className="text-3xl font-black tracking-tight">
                            {isKo ? '계정 삭제 안내' : 'Delete Account'}
                        </h1>
                    </div>
                    <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                        {isKo ? '최종 수정일: 2026년 3월 9일' : 'Last updated: March 9, 2026'}
                    </p>
                </div>

                <div className="space-y-8">
                    {/* Method 1 */}
                    <section className={`p-8 rounded-3xl ${theme === 'dark' ? 'bg-white/5 border border-white/10' : 'bg-slate-50 border border-slate-100'}`}>
                        <h2 className="text-xl font-black mb-4">
                            {isKo ? '방법 1: 앱 내에서 삭제' : 'Method 1: Delete in App'}
                        </h2>
                        <ol className="space-y-2">
                            {(isKo
                                ? ['Velo 앱 실행', '설정 메뉴 진입', '계정 삭제 버튼 클릭', '확인 후 삭제 요청 완료']
                                : ['Launch the Velo app', 'Go to Settings', 'Click Delete Account', 'Confirm to complete the request']
                            ).map((step, i) => (
                                <li key={i} className={`flex items-start gap-3 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>
                                    <span className="w-6 h-6 rounded-full bg-red-500/20 text-red-500 text-xs font-black flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                                    {step}
                                </li>
                            ))}
                        </ol>
                    </section>

                    {/* Method 2 */}
                    <section className={`p-8 rounded-3xl ${theme === 'dark' ? 'bg-white/5 border border-white/10' : 'bg-slate-50 border border-slate-100'}`}>
                        <h2 className="text-xl font-black mb-4">
                            {isKo ? '방법 2: 이메일로 삭제 요청' : 'Method 2: Request via Email'}
                        </h2>
                        <div className={`space-y-2 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>
                            <p><span className="font-bold">{isKo ? '이메일: ' : 'Email: '}</span><a href="mailto:contact@smileon.app" className="text-indigo-500 hover:underline">contact@smileon.app</a></p>
                            <p><span className="font-bold">{isKo ? '제목: ' : 'Subject: '}</span>{isKo ? '계정 삭제 요청' : 'Account Deletion Request'}</p>
                            <p><span className="font-bold">{isKo ? '본문: ' : 'Body: '}</span>{isKo ? '가입 시 사용한 이메일 주소를 포함해 주세요.' : 'Please include the email address used to register.'}</p>
                        </div>
                    </section>

                    {/* Deleted data */}
                    <section className={`p-8 rounded-3xl ${theme === 'dark' ? 'bg-red-500/10 border border-red-500/20' : 'bg-red-50 border border-red-100'}`}>
                        <h2 className="text-xl font-black mb-4">
                            {isKo ? '삭제되는 데이터' : 'Data That Will Be Deleted'}
                        </h2>
                        <ul className="space-y-2">
                            {(isKo
                                ? ['이메일 주소 및 프로필 정보', '구독 및 라이선스 정보', '앱 사용 기록']
                                : ['Email address and profile information', 'Subscription and license information', 'App usage history']
                            ).map((item, i) => (
                                <li key={i} className={`flex items-start gap-3 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>
                                    <div className="w-1.5 h-1.5 rounded-full bg-red-500 mt-2.5 shrink-0" />
                                    {item}
                                </li>
                            ))}
                        </ul>
                    </section>

                    {/* Retained data */}
                    <section className={`p-8 rounded-3xl ${theme === 'dark' ? 'bg-white/5 border border-white/10' : 'bg-slate-50 border border-slate-100'}`}>
                        <h2 className="text-xl font-black mb-4">
                            {isKo ? '보관되는 데이터' : 'Data Retained Temporarily'}
                        </h2>
                        <p className={`leading-relaxed ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>
                            {isKo
                                ? '법적 의무 및 분쟁 해결을 위해 결제 거래 내역은 삭제 요청 후 30일간 보관 후 영구 삭제됩니다.'
                                : 'Payment transaction records will be retained for 30 days after the deletion request for legal and dispute resolution purposes, then permanently deleted.'
                            }
                        </p>
                    </section>

                    {/* Processing time */}
                    <section className={`p-8 rounded-3xl ${theme === 'dark' ? 'bg-white/5 border border-white/10' : 'bg-slate-50 border border-slate-100'}`}>
                        <h2 className="text-xl font-black mb-4">
                            {isKo ? '처리 기간' : 'Processing Time'}
                        </h2>
                        <p className={`leading-relaxed ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>
                            {isKo
                                ? '계정 삭제 요청은 영업일 기준 7일 이내에 처리됩니다.'
                                : 'Account deletion requests are processed within 7 business days.'
                            }
                        </p>
                    </section>

                    {/* Notice */}
                    <section className={`p-8 rounded-3xl ${theme === 'dark' ? 'bg-amber-500/10 border border-amber-500/20' : 'bg-amber-50 border border-amber-100'}`}>
                        <h2 className="text-xl font-black mb-4">
                            {isKo ? '유의 사항' : 'Important Notes'}
                        </h2>
                        <ul className="space-y-3">
                            {(isKo
                                ? [
                                    '계정 삭제 시 활성 구독이 있는 경우, Google Play 또는 Apple App Store에서 구독을 먼저 취소해 주세요. 계정 삭제만으로는 구독이 자동 취소되지 않습니다.',
                                    '평생 라이선스를 보유한 경우, 계정 삭제 후 동일 계정으로 복구할 수 없습니다.'
                                ]
                                : [
                                    'If you have an active subscription, please cancel it first on Google Play or Apple App Store. Deleting your account does not automatically cancel subscriptions.',
                                    'If you hold a lifetime license, it cannot be recovered after account deletion.'
                                ]
                            ).map((item, i) => (
                                <li key={i} className={`flex items-start gap-3 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>
                                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-2.5 shrink-0" />
                                    {item}
                                </li>
                            ))}
                        </ul>
                    </section>
                </div>

                {/* Contact */}
                <div className={`mt-12 p-8 rounded-3xl text-center ${theme === 'dark' ? 'bg-white/5 border border-white/10' : 'bg-slate-50 border border-slate-100'}`}>
                    <p className={`text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                        {isKo ? '추가 문의' : 'Contact'}
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

export default DeleteAccount;
