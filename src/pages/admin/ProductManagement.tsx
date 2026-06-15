import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Archive, Copy, PackagePlus, Plus, Save, Search, Star } from "lucide-react";
import type { Product, ProductImage } from "../../../server/types";
import { useProducts } from "../../hooks/useProducts";
import { productService } from "../../services/product.service";
import { toast } from "sonner";
import { slugify } from "../../utils/slugify";

const PAGE_SIZE = 12;
const EMPTY_PRODUCTS: Product[] = [];
const DRAFT_STORAGE_KEY = "noir-admin-product-draft-v1";
const MAX_IMAGE_FILE_BYTES = 5 * 1024 * 1024;
const MAX_IMAGE_DATA_URL_BYTES = 250 * 1024;
const MAX_TOTAL_IMAGE_DATA_URL_BYTES = 900 * 1024;
const MAX_IMAGE_COUNT = 8;

type ProductEditorState = Product & { id?: string };

const TEXT_FIELDS: Array<{ field: keyof Product; label: string }> = [
  { field: "name", label: "Name" },
  { field: "slug", label: "Slug" },
  { field: "brand", label: "Brand" },
  { field: "sku", label: "SKU" },
  { field: "category", label: "Category" },
  { field: "subtitle", label: "Subtitle" },
];
const TOGGLE_FIELDS: Array<{ field: "isFeatured" | "isNewArrival" | "isBestSeller"; label: string }> = [
  { field: "isFeatured", label: "Featured" },
  { field: "isNewArrival", label: "New Arrival" },
  { field: "isBestSeller", label: "Best Seller" },
];

function toBytesFromDataUrl(value: string): number {
  const base64 = value.split(",")[1] || "";
  return Math.ceil((base64.length * 3) / 4);
}

function totalImageBytes(images: ProductImage[]): number {
  return images.reduce((sum, image) => sum + (isInlineImage(image.url) ? toBytesFromDataUrl(image.url) : 0), 0);
}

function isInlineImage(url: string): boolean {
  return url.startsWith("data:image/");
}

async function readImageFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function compressImage(file: File): Promise<string> {
  const sourceDataUrl = await readImageFileAsDataUrl(file);
  if (toBytesFromDataUrl(sourceDataUrl) <= MAX_IMAGE_DATA_URL_BYTES) {
    return sourceDataUrl;
  }

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("Unable to read image."));
    el.src = sourceDataUrl;
  });

  const canvas = document.createElement("canvas");
  const maxDimension = 1200;
  const widthRatio = maxDimension / image.width;
  const heightRatio = maxDimension / image.height;
  const ratio = Math.min(1, widthRatio, heightRatio);
  canvas.width = Math.max(1, Math.round(image.width * ratio));
  canvas.height = Math.max(1, Math.round(image.height * ratio));

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Unable to process image.");
  }

  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  let quality = 0.9;
  let encoded = canvas.toDataURL("image/jpeg", quality);

  while (toBytesFromDataUrl(encoded) > MAX_IMAGE_DATA_URL_BYTES && quality > 0.45) {
    quality -= 0.1;
    encoded = canvas.toDataURL("image/jpeg", quality);
  }

  if (toBytesFromDataUrl(encoded) > MAX_IMAGE_DATA_URL_BYTES) {
    throw new Error(`"${file.name}" is too large after compression. Use a smaller image.`);
  }

  return encoded;
}

function sanitizeEditorProduct(editing: ProductEditorState): ProductEditorState {
  const normalizedName = editing.name.trim();
  const normalizedSlug = (editing.slug || slugify(normalizedName)).trim();
  const normalizedDescription = editing.description.trim();
  const normalizedSku = editing.sku.trim().toUpperCase();
  const normalizedBrand = editing.brand.trim();
  const normalizedCategory = editing.category.trim();

  const images = editing.images
    .filter((image) => Boolean(image.url))
    .map((image) => ({
      ...image,
      alt: image.alt.trim() || normalizedName || "Product image",
      isPrimary: Boolean(image.isPrimary),
    }));

  const hasPrimary = images.some((image) => image.isPrimary);
  if (images.length > 0 && !hasPrimary) {
    images[0].isPrimary = true;
  }

  const status = editing.status;
  const visibility =
    status === "published"
      ? "public"
      : status === "archived"
        ? "hidden"
        : editing.visibility;

  return {
    ...editing,
    name: normalizedName,
    slug: normalizedSlug,
    description: normalizedDescription,
    luxuryDescription: editing.luxuryDescription?.trim() || normalizedDescription,
    sku: normalizedSku,
    brand: normalizedBrand,
    category: normalizedCategory,
    price: Number(editing.price || 0),
    discountPrice: editing.discountPrice == null || editing.discountPrice === 0 ? undefined : Number(editing.discountPrice),
    stockQuantity: Math.max(0, Math.floor(Number(editing.stockQuantity || 0))),
    lowStockThreshold: Math.max(0, Math.floor(Number(editing.lowStockThreshold || 0))),
    displayOrder: Math.max(0, Math.floor(Number(editing.displayOrder || 0))),
    status,
    visibility,
    tags: editing.tags.map((tag) => tag.trim()).filter(Boolean),
    sizes: editing.sizes.map((size) => size.trim()).filter(Boolean),
    notes: {
      top: editing.notes.top.map((value) => value.trim()).filter(Boolean),
      middle: editing.notes.middle.map((value) => value.trim()).filter(Boolean),
      base: editing.notes.base.map((value) => value.trim()).filter(Boolean),
    },
    images,
    seo: {
      title: editing.seo?.title?.trim() || normalizedName,
      description: editing.seo?.description?.trim() || normalizedDescription,
      keywords: (editing.seo?.keywords || editing.tags).map((entry) => entry.trim()).filter(Boolean),
    },
  };
}

function createEmptyProduct(): ProductEditorState {
  const now = new Date().toISOString();
  return {
    id: "",
    slug: "",
    name: "",
    brand: "NOIR",
    subtitle: "",
    description: "",
    luxuryDescription: "",
    price: 0,
    discountPrice: undefined,
    stockQuantity: 0,
    lowStockThreshold: 5,
    sku: "",
    category: "Fragrance",
    collection: "Core",
    gender: "unisex",
    notes: { top: [], middle: [], base: [] },
    tags: [],
    sizes: ["50ml", "100ml"],
    images: [],
    status: "draft",
    visibility: "hidden",
    isFeatured: false,
    isNewArrival: false,
    isBestSeller: false,
    displayOrder: 0,
    seo: { title: "", description: "", keywords: [] },
    inventoryHistory: [],
    createdBy: "admin",
    updatedBy: "admin",
    createdAt: now,
    updatedAt: now,
  };
}

export const ProductManagement = () => {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [visibility, setVisibility] = useState("all");
  const [collection, setCollection] = useState("all");
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editing, setEditing] = useState<ProductEditorState | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);

  const { data, isLoading, archiveProduct, duplicateProduct, adjustInventory, refetch } = useProducts({
    search,
    status,
    visibility,
    collection,
    page,
    pageSize: PAGE_SIZE,
  });

  useEffect(() => {
    setPage(1);
  }, [search, status, visibility, collection]);

  useEffect(() => {
    if (editing) return;
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as ProductEditorState;
      if (parsed && typeof parsed === "object") {
        setEditing(parsed);
        toast.info("Recovered unsaved product draft.");
      }
    } catch {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
    }
  }, [editing]);

  useEffect(() => {
    if (!editing) {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
      return;
    }

    const isNewDraft = !editing.id;
    if (!isNewDraft) {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
      return;
    }

    try {
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(editing));
    } catch {
      toast.error("Draft autosave failed because local browser storage is full. Save the product now to avoid losing changes.");
    }
  }, [editing]);

  const products = data?.products ?? EMPTY_PRODUCTS;
  const totalPages = Math.max(1, Math.ceil((data?.total || 0) / PAGE_SIZE));

  const selectedProducts = useMemo(
    () => products.filter((product) => selectedIds.includes(product.id)),
    [products, selectedIds]
  );

  const handleSave = async () => {
    if (!editing) return;

    const payload = sanitizeEditorProduct(editing);
    if (!payload.name || !payload.slug || !payload.description || !payload.sku) {
      toast.error("Name, slug, description, and SKU are required.");
      return;
    }
    if (payload.price <= 0) {
      toast.error("Price must be greater than zero.");
      return;
    }
    if (payload.discountPrice != null && payload.discountPrice >= payload.price) {
      toast.error("Discount price must be lower than the regular price.");
      return;
    }

    setSaving(true);
    try {
      const isCreate = !payload.id;
      if (isCreate) {
        await productService.createProduct(payload);
      } else {
        await productService.updateProduct(payload.id, payload);
      }
      toast.success(isCreate ? "Product created" : "Product updated");
      setEditing(null);
      await refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save product");
    } finally {
      setSaving(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((current) => (current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id]));
  };

  const handleBulkArchive = async () => {
    if (selectedProducts.length === 0) return;
    try {
      await Promise.all(selectedProducts.map((product) => archiveProduct(product.id)));
      toast.success(`${selectedProducts.length} product(s) archived`);
      setSelectedIds([]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bulk archive failed");
    }
  };

  const handleQuickPatch = async (product: Product, updates: Partial<Product>) => {
    try {
      const nextProduct = sanitizeEditorProduct({ ...product, ...updates });
      await productService.updateProduct(product.id, nextProduct);
      toast.success("Product updated");
      await refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update product");
    }
  };

  const addImageFiles = async (files: FileList | null) => {
    if (!editing || !files || files.length === 0) return;

    const availableSlots = Math.max(0, MAX_IMAGE_COUNT - editing.images.length);
    if (availableSlots <= 0) {
      toast.error(`A product supports up to ${MAX_IMAGE_COUNT} images.`);
      return;
    }

    const incoming = Array.from(files).slice(0, availableSlots);
    const rejected = Array.from(files).length - incoming.length;
    if (rejected > 0) {
      toast.warning(`${rejected} image(s) skipped because the product is at image limit.`);
    }

    setUploadingImages(true);
    const nextImages: ProductImage[] = [];

    for (const file of incoming) {
      if (!file.type.startsWith("image/")) {
        toast.error(`"${file.name}" is not an image file.`);
        continue;
      }
      if (file.size > MAX_IMAGE_FILE_BYTES) {
        toast.error(`"${file.name}" exceeds the 5MB upload limit.`);
        continue;
      }

      try {
        const url = await compressImage(file);
        nextImages.push({
          id: crypto.randomUUID(),
          url,
          alt: file.name.replace(/\.[^/.]+$/, ""),
          isPrimary: editing.images.length + nextImages.length === 0,
        });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : `Failed to process ${file.name}`);
      }
    }

    if (nextImages.length > 0) {
      const mergedImages = [...editing.images, ...nextImages];
      const bytes = totalImageBytes(mergedImages);
      if (bytes > MAX_TOTAL_IMAGE_DATA_URL_BYTES) {
        toast.error("Total inline image payload is too large for reliable drafts. Remove some images or use smaller files.");
        setUploadingImages(false);
        return;
      }

      setEditing({
        ...editing,
        images: mergedImages,
      });
      toast.success(`${nextImages.length} image(s) added.`);
    }
    setUploadingImages(false);
  };

  return (
    <div className="min-h-screen bg-background pt-24 pb-16 px-4">
      <div className="container mx-auto max-w-7xl space-y-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="font-serif text-3xl font-bold gold-text">Catalogue Operations</h1>
            <p className="text-sm text-muted-foreground">Product control, pricing, inventory, and media management.</p>
          </div>
          <div className="flex gap-3">
            <Link
              to="/admin"
              className="px-4 py-2 border border-border text-muted-foreground text-[10px] tracking-widest uppercase font-bold hover:text-foreground"
            >
              <ArrowLeft className="inline-block mr-2 h-3 w-3" />
              Back
            </Link>
            <button
              onClick={() => setEditing(createEmptyProduct())}
              className="px-4 py-2 bg-primary text-primary-foreground text-[10px] tracking-widest uppercase font-bold"
            >
              <Plus className="inline-block mr-2 h-3 w-3" />
              New Product
            </button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-5">
          <div className="glass-panel p-4 md:col-span-2">
            <label className="mb-2 block text-[10px] tracking-widest uppercase text-muted-foreground">Search</label>
            <div className="flex items-center gap-2 border border-border px-3 py-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search SKU, tag, name, brand"
                className="w-full bg-transparent text-sm outline-none"
              />
            </div>
          </div>
          {[
            { label: "Status", value: status, onChange: setStatus, options: ["all", "published", "draft", "archived"] },
            { label: "Visibility", value: visibility, onChange: setVisibility, options: ["all", "public", "hidden"] },
            { label: "Collection", value: collection, onChange: setCollection, options: ["all", "Core", "Limited", "Archive", "Seasonal"] },
          ].map((filter) => (
            <div key={filter.label} className="glass-panel p-4">
              <label className="mb-2 block text-[10px] tracking-widest uppercase text-muted-foreground">{filter.label}</label>
              <select
                value={filter.value}
                onChange={(e) => filter.onChange(e.target.value)}
                className="w-full bg-background border border-border px-3 py-2 text-sm"
              >
                {filter.options.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>

        <div className="glass-panel p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="text-xs text-muted-foreground">
            {data?.total || 0} products • {data?.lowStockCount || 0} low stock • page {page} of {totalPages}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              disabled={selectedIds.length === 0}
              onClick={() => void handleBulkArchive()}
              className="px-3 py-2 border border-border text-[10px] tracking-widest uppercase font-bold disabled:opacity-50"
            >
              <Archive className="mr-2 inline-block h-3 w-3" />
              Archive Selected
            </button>
          </div>
        </div>

        <div className="glass-panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-black/20">
                <tr className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  <th className="px-4 py-4"></th>
                  <th className="px-4 py-4">Product</th>
                  <th className="px-4 py-4">Price</th>
                  <th className="px-4 py-4">Inventory</th>
                  <th className="px-4 py-4">Visibility</th>
                  <th className="px-4 py-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                      Loading catalogue…
                    </td>
                  </tr>
                ) : (
                  products.map((product) => (
                    <tr key={product.id} className="border-t border-border/40 align-top">
                      <td className="px-4 py-4">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(product.id)}
                          onChange={() => toggleSelect(product.id)}
                          className="accent-primary"
                        />
                      </td>
                      <td className="px-4 py-4">
                        <div className="space-y-1">
                          <p className="font-bold">{product.name}</p>
                          <p className="text-xs text-muted-foreground">{product.brand} • {product.sku}</p>
                          <p className="text-[10px] uppercase tracking-widest text-primary">{product.collection}</p>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm">
                        KES {Math.round(product.price).toLocaleString()}
                        {product.discountPrice ? (
                          <div className="text-xs text-muted-foreground">Sale KES {Math.round(product.discountPrice).toLocaleString()}</div>
                        ) : null}
                      </td>
                      <td className="px-4 py-4 text-sm">
                        <span className={product.stockQuantity <= product.lowStockThreshold ? "text-red-400" : ""}>
                          {product.stockQuantity} in stock
                        </span>
                        <div className="text-xs text-muted-foreground">Low stock at {product.lowStockThreshold}</div>
                      </td>
                      <td className="px-4 py-4 text-sm">
                        <div>{product.status}</div>
                        <div className="text-xs text-muted-foreground">{product.visibility}</div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => setEditing(product)}
                            className="px-3 py-1.5 border border-border text-[10px] tracking-widest uppercase font-bold"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => void duplicateProduct(product.id)}
                            className="px-3 py-1.5 border border-border text-[10px] tracking-widest uppercase font-bold"
                          >
                            <Copy className="mr-1 inline-block h-3 w-3" />
                            Duplicate
                          </button>
                          <button
                            onClick={() => void handleQuickPatch(product, { status: product.status === "published" ? "draft" : "published" })}
                            className="px-3 py-1.5 border border-border text-[10px] tracking-widest uppercase font-bold"
                          >
                            {product.status === "published" ? "Unpublish" : "Publish"}
                          </button>
                          <button
                            onClick={() => void handleQuickPatch(product, { isFeatured: !product.isFeatured })}
                            className="px-3 py-1.5 border border-border text-[10px] tracking-widest uppercase font-bold"
                          >
                            <Star className="mr-1 inline-block h-3 w-3" />
                            {product.isFeatured ? "Unfeature" : "Feature"}
                          </button>
                          <button
                            onClick={() => {
                              const raw = window.prompt("Inventory adjustment (use negative numbers to reduce stock)", "0");
                              if (raw == null) return;
                              const delta = Number(raw);
                              if (!Number.isFinite(delta) || delta === 0) return;
                              void adjustInventory({ id: product.id, delta, note: "Admin quick adjustment" });
                            }}
                            className="px-3 py-1.5 border border-border text-[10px] tracking-widest uppercase font-bold"
                          >
                            <PackagePlus className="mr-1 inline-block h-3 w-3" />
                            Adjust Stock
                          </button>
                          <button
                            onClick={() => void archiveProduct(product.id)}
                            className="px-3 py-1.5 border border-red-500/30 text-red-400 text-[10px] tracking-widest uppercase font-bold"
                          >
                            Archive
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <button
            disabled={page <= 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            className="px-4 py-2 border border-border text-[10px] tracking-widest uppercase font-bold disabled:opacity-50"
          >
            Previous
          </button>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            className="px-4 py-2 border border-border text-[10px] tracking-widest uppercase font-bold disabled:opacity-50"
          >
            Next
          </button>
        </div>

        {editing ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-panel p-6 space-y-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-serif text-2xl font-bold">{editing.name || "New Product"}</h2>
                <p className="text-sm text-muted-foreground">Edit operational, media, and catalogue metadata.</p>
              </div>
              <button onClick={() => setEditing(null)} className="text-sm text-muted-foreground">Close</button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {TEXT_FIELDS.map(({ field, label }) => (
                <div key={field} className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</label>
                  <input
                    value={String(editing[field] || "")}
                    onChange={(e) => setEditing({ ...editing, [field]: e.target.value })}
                    className="w-full bg-background border border-border px-3 py-2 text-sm"
                  />
                </div>
              ))}
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Price</label>
                <input
                  type="number"
                  value={editing.price}
                  onChange={(e) => setEditing({ ...editing, price: Number(e.target.value) })}
                  className="w-full bg-background border border-border px-3 py-2 text-sm"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Discount Price</label>
                <input
                  type="number"
                  value={editing.discountPrice ?? ""}
                  onChange={(e) => setEditing({ ...editing, discountPrice: e.target.value ? Number(e.target.value) : undefined })}
                  className="w-full bg-background border border-border px-3 py-2 text-sm"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Stock Quantity</label>
                <input
                  type="number"
                  value={editing.stockQuantity}
                  onChange={(e) => setEditing({ ...editing, stockQuantity: Number(e.target.value) })}
                  className="w-full bg-background border border-border px-3 py-2 text-sm"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Low Stock Threshold</label>
                <input
                  type="number"
                  value={editing.lowStockThreshold}
                  onChange={(e) => setEditing({ ...editing, lowStockThreshold: Number(e.target.value) })}
                  className="w-full bg-background border border-border px-3 py-2 text-sm"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Collection</label>
                <select
                  value={editing.collection}
                  onChange={(e) => setEditing({ ...editing, collection: e.target.value as Product["collection"] })}
                  className="w-full bg-background border border-border px-3 py-2 text-sm"
                >
                  {["Core", "Limited", "Archive", "Seasonal"].map((entry) => (
                    <option key={entry} value={entry}>{entry}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Gender</label>
                <select
                  value={editing.gender}
                  onChange={(e) => setEditing({ ...editing, gender: e.target.value as Product["gender"] })}
                  className="w-full bg-background border border-border px-3 py-2 text-sm"
                >
                  {["masculine", "feminine", "unisex"].map((entry) => (
                    <option key={entry} value={entry}>{entry}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Status</label>
                <select
                  value={editing.status}
                  onChange={(e) => setEditing({ ...editing, status: e.target.value as Product["status"] })}
                  className="w-full bg-background border border-border px-3 py-2 text-sm"
                >
                  {["draft", "published", "archived"].map((entry) => (
                    <option key={entry} value={entry}>{entry}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Visibility</label>
                <select
                  value={editing.visibility}
                  onChange={(e) => setEditing({ ...editing, visibility: e.target.value as Product["visibility"] })}
                  className="w-full bg-background border border-border px-3 py-2 text-sm"
                >
                  {["hidden", "public"].map((entry) => (
                    <option key={entry} value={entry}>{entry}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Description</label>
                <textarea
                  value={editing.description}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                  rows={4}
                  className="w-full bg-background border border-border px-3 py-2 text-sm"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Luxury Copy</label>
                <textarea
                  value={editing.luxuryDescription}
                  onChange={(e) => setEditing({ ...editing, luxuryDescription: e.target.value })}
                  rows={4}
                  className="w-full bg-background border border-border px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {[
                ["top", "Top Notes"],
                ["middle", "Middle Notes"],
                ["base", "Base Notes"],
              ].map(([field, label]) => (
                <div key={field} className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</label>
                  <input
                    value={editing.notes[field as keyof Product["notes"]].join(", ")}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        notes: {
                          ...editing.notes,
                          [field]: e.target.value.split(",").map((entry) => entry.trim()).filter(Boolean),
                        },
                      })
                    }
                    className="w-full bg-background border border-border px-3 py-2 text-sm"
                  />
                </div>
              ))}
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Tags</label>
                <input
                  value={editing.tags.join(", ")}
                  onChange={(e) => setEditing({ ...editing, tags: e.target.value.split(",").map((entry) => entry.trim()) })}
                  className="w-full bg-background border border-border px-3 py-2 text-sm"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Sizes</label>
                <input
                  value={editing.sizes.join(", ")}
                  onChange={(e) => setEditing({ ...editing, sizes: e.target.value.split(",").map((entry) => entry.trim()) })}
                  className="w-full bg-background border border-border px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {TOGGLE_FIELDS.map(({ field, label }) => (
                <label key={field} className="flex items-center gap-3 rounded border border-border px-4 py-3 text-sm">
                  <input
                    type="checkbox"
                    checked={Boolean(editing[field])}
                    onChange={(e) => setEditing({ ...editing, [field]: e.target.checked })}
                    className="accent-primary"
                  />
                  {label}
                </label>
              ))}
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-serif text-xl font-bold">Product Media</h3>
                  <p className="text-xs text-muted-foreground">Upload files, reorder, remove, and set the primary image.</p>
                  <p className="text-[10px] text-muted-foreground">JPEG/PNG up to 5MB each. Images are auto-compressed for persistence.</p>
                </div>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  disabled={uploadingImages}
                  onChange={(e) => {
                    void addImageFiles(e.target.files);
                    e.currentTarget.value = "";
                  }}
                />
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                {editing.images.map((image, index) => (
                  <div key={image.id} className="rounded border border-border p-3 space-y-3">
                    <img src={image.url} alt={image.alt} className="h-40 w-full object-cover rounded" />
                    <input
                      value={image.alt}
                      onChange={(e) =>
                        setEditing({
                          ...editing,
                          images: editing.images.map((entry) => (entry.id === image.id ? { ...entry, alt: e.target.value } : entry)),
                        })
                      }
                      className="w-full bg-background border border-border px-3 py-2 text-sm"
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() =>
                          setEditing({
                            ...editing,
                            images: editing.images.map((entry) => ({ ...entry, isPrimary: entry.id === image.id })),
                          })
                        }
                        className="px-3 py-1.5 border border-border text-[10px] tracking-widest uppercase font-bold"
                      >
                        Primary
                      </button>
                      {index > 0 ? (
                        <button
                          onClick={() => {
                            const next = [...editing.images];
                            [next[index - 1], next[index]] = [next[index], next[index - 1]];
                            setEditing({ ...editing, images: next });
                          }}
                          className="px-3 py-1.5 border border-border text-[10px] tracking-widest uppercase font-bold"
                        >
                          Up
                        </button>
                      ) : null}
                      {index < editing.images.length - 1 ? (
                        <button
                          onClick={() => {
                            const next = [...editing.images];
                            [next[index + 1], next[index]] = [next[index], next[index + 1]];
                            setEditing({ ...editing, images: next });
                          }}
                          className="px-3 py-1.5 border border-border text-[10px] tracking-widest uppercase font-bold"
                        >
                          Down
                        </button>
                      ) : null}
                      <button
                        onClick={() =>
                          setEditing({
                            ...editing,
                            images: editing.images.filter((entry) => entry.id !== image.id),
                          })
                        }
                        className="px-3 py-1.5 border border-red-500/30 text-red-400 text-[10px] tracking-widest uppercase font-bold"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest text-muted-foreground">SEO Title</label>
                <input
                  value={editing.seo?.title || ""}
                  onChange={(e) => setEditing({ ...editing, seo: { ...editing.seo, title: e.target.value } })}
                  className="w-full bg-background border border-border px-3 py-2 text-sm"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest text-muted-foreground">SEO Keywords</label>
                <input
                  value={editing.seo?.keywords?.join(", ") || ""}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      seo: {
                        ...editing.seo,
                        keywords: e.target.value.split(",").map((entry) => entry.trim()).filter(Boolean),
                      },
                    })
                  }
                  className="w-full bg-background border border-border px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground">SEO Description</label>
              <textarea
                value={editing.seo?.description || ""}
                onChange={(e) => setEditing({ ...editing, seo: { ...editing.seo, description: e.target.value } })}
                rows={3}
                className="w-full bg-background border border-border px-3 py-2 text-sm"
              />
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setEditing(null)}
                className="px-4 py-2 border border-border text-[10px] tracking-widest uppercase font-bold"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleSave()}
                disabled={saving || uploadingImages}
                className="px-4 py-2 bg-primary text-primary-foreground text-[10px] tracking-widest uppercase font-bold disabled:opacity-50"
              >
                <Save className="mr-2 inline-block h-3 w-3" />
                {uploadingImages ? "Processing Images..." : saving ? "Saving..." : "Save Product"}
              </button>
            </div>
          </motion.div>
        ) : null}
      </div>
    </div>
  );
};
