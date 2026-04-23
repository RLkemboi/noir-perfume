import { useEffect } from "react";

interface SEOProps {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  type?: "website" | "product";
  structuredData?: object;
}

const BASE_URL = "https://noir-perfume.onrender.com";
const DEFAULT_TITLE = "NOIR Perfume — Luxury Fragrances | Oud, Amber & Rare Scents";
const DEFAULT_DESCRIPTION =
  "Shop NOIR's curated collection of ultra-premium fragrances — house scents and iconic brands like Tom Ford, Creed, Dior, Chanel & more.";
const DEFAULT_IMAGE = `${BASE_URL}/assets/og-cover.jpg`;

function setMeta(name: string, content: string, attr: "name" | "property" = "name") {
  let el = document.querySelector(`meta[${attr}="${name}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function setStructuredData(id: string, data: object) {
  let el = document.getElementById(id) as HTMLScriptElement | null;
  if (!el) {
    el = document.createElement("script");
    el.id = id;
    el.type = "application/ld+json";
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(data);
}

export function useSEO({
  title = DEFAULT_TITLE,
  description = DEFAULT_DESCRIPTION,
  image = DEFAULT_IMAGE,
  url,
  type = "website",
  structuredData,
}: SEOProps = {}) {
  useEffect(() => {
    const fullTitle = title === DEFAULT_TITLE ? title : `${title} — NOIR Perfume`;
    const canonicalUrl = url ? `${BASE_URL}${url}` : BASE_URL;

    // Title
    document.title = fullTitle;

    // Basic meta
    setMeta("description", description);
    setMeta("robots", "index, follow");

    // Canonical
    let canonical = document.querySelector("link[rel='canonical']") as HTMLLinkElement | null;
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.appendChild(canonical);
    }
    canonical.href = canonicalUrl;

    // Open Graph
    setMeta("og:title", fullTitle, "property");
    setMeta("og:description", description, "property");
    setMeta("og:image", image, "property");
    setMeta("og:url", canonicalUrl, "property");
    setMeta("og:type", type, "property");

    // Twitter Card
    setMeta("twitter:title", fullTitle);
    setMeta("twitter:description", description);
    setMeta("twitter:image", image);

    // Structured Data
    if (structuredData) {
      setStructuredData("page-structured-data", structuredData);
    }
  }, [title, description, image, url, type, structuredData]);
}

/** Build Product structured data for Google Shopping / Rich Results */
export function buildProductSchema(product: {
  id: string;
  name: string;
  brand: string;
  description: string;
  price: string;
  image: string;
  rating: number;
  reviews: number;
}) {
  const priceNum = Number(product.price.replace(/[^0-9.]/g, "")) || 0;
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    brand: {
      "@type": "Brand",
      name: product.brand,
    },
    image: product.image.startsWith("http")
      ? product.image
      : `${BASE_URL}${product.image}`,
    url: `${BASE_URL}/product/${product.id}`,
    offers: {
      "@type": "Offer",
      price: priceNum,
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
      seller: {
        "@type": "Organization",
        name: "NOIR Perfume",
      },
    },
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: product.rating,
      reviewCount: product.reviews,
      bestRating: 5,
      worstRating: 1,
    },
  };
}
