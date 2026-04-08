import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';

interface SEOProps {
    title?: string;
    description?: string;
    keywords?: string;
    type?: string;
    name?: string;
    canonicalPath?: string;
    image?: string;
    noindex?: boolean;
    structuredData?: Record<string, unknown> | null;
}

const SITE_URL = import.meta.env.VITE_SITE_URL || 'https://velo.smileon.app';

const SEO = ({
    title,
    description,
    keywords,
    type = 'website',
    name = 'Velo',
    canonicalPath,
    image = '/Velo_meta_image.png',
    noindex = false,
    structuredData = null,
}: SEOProps) => {
    const { t, i18n } = useTranslation();

    const seoTitle = title || t('seo.title');
    const seoDescription = description || t('seo.description');
    const seoKeywords = keywords || t('seo.keywords');
    const currentPath = canonicalPath || window.location.pathname;
    const canonicalUrl = new URL(currentPath, SITE_URL).toString();
    const imageUrl = new URL(image, SITE_URL).toString();
    const locale = i18n.language.startsWith('ko') ? 'ko_KR' : 'en_US';

    return (
        <Helmet>
            {/* Standard metadata tags */}
            <title>{seoTitle}</title>
            <meta name='description' content={seoDescription} />
            <meta name='keywords' content={seoKeywords} />
            <meta name="robots" content={noindex ? 'noindex,nofollow' : 'index,follow,max-image-preview:large'} />

            {/* Facebook tags */}
            <meta property="og:type" content={type} />
            <meta property="og:title" content={seoTitle} />
            <meta property="og:description" content={seoDescription} />
            <meta property="og:site_name" content={name} />
            <meta property="og:locale" content={locale} />
            <meta property="og:url" content={canonicalUrl} />
            <meta property="og:image" content={imageUrl} />

            {/* Twitter tags */}
            <meta name="twitter:creator" content={name} />
            <meta name="twitter:card" content="summary_large_image" />
            <meta name="twitter:title" content={seoTitle} />
            <meta name="twitter:description" content={seoDescription} />
            <meta name="twitter:image" content={imageUrl} />

            {/* Canonical link */}
            <link rel="canonical" href={canonicalUrl} />
            <link rel="alternate" hrefLang="x-default" href={new URL('/', SITE_URL).toString()} />
            <link rel="alternate" hrefLang="en" href={new URL('/', SITE_URL).toString()} />
            <link rel="alternate" hrefLang="ko" href={new URL('/', SITE_URL).toString()} />

            {structuredData ? (
                <script type="application/ld+json">
                    {JSON.stringify(structuredData)}
                </script>
            ) : null}
        </Helmet>
    );
};

export default SEO;
