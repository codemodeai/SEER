"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useDashboard } from "@/lib/dashboard-context";
import {
  Upload,
  FileText,
  Download,
  Trash2,
  Loader2,
  X,
  AlertTriangle,
  Clock,
  File as FileIcon,
} from "lucide-react";

interface Document {
  id: string;
  filename: string;
  doc_type: string;
  expiry_date: string | null;
  tags: string[];
  file_size: number;
  created_at: string;
  project_id: string | null;
  fs_projects: { name: string } | null;
}

const DOC_TYPE_BADGES: Record<string, { bg: string; text: string; label: string }> = {
  agreement: { bg: "bg-purple-100", text: "text-purple-700", label: "Agreement" },
  certificate: { bg: "bg-blue-100", text: "text-blue-700", label: "Certificate" },
  invoice: { bg: "bg-emerald-100", text: "text-emerald-700", label: "Invoice" },
  other: { bg: "bg-gray-100", text: "text-gray-600", label: "Other" },
};

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getExpiryStatus(expiryDate: string | null): "ok" | "warning" | "expired" | null {
  if (!expiryDate) return null;
  const now = new Date();
  const expiry = new Date(expiryDate);
  if (expiry < now) return "expired";
  const daysUntil = (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  if (daysUntil < 30) return "warning";
  return "ok";
}

export default function DocumentsPanel({ teamMode = false, selectedProjectId = null, projects = [] }: { teamMode?: boolean; selectedProjectId?: string | null; projects?: { id: string; name: string }[] }) {
  const { userId } = useDashboard();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [canWrite, setCanWrite] = useState(true);

  // Upload state
  const [showUpload, setShowUpload] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadDocType, setUploadDocType] = useState("other");
  const [uploadExpiry, setUploadExpiry] = useState("");
  const [uploadTags, setUploadTags] = useState("");
  const [uploadProject, setUploadProject] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Delete confirmation
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Download loading
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const fetchDocuments = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (teamMode) params.set("team", "true");
      if (selectedProjectId) params.set("project_id", selectedProjectId);
      const qs = params.toString() ? `?${params.toString()}` : "";
      const res = await fetch(`/api/founders-space/documents${qs}`);
      if (res.ok) {
        const data = await res.json();
        setDocuments(data.documents || []);
        if (data.canWrite !== undefined) setCanWrite(data.canWrite);
      }
    } catch (err) {
      console.error("Failed to fetch documents:", err);
    } finally {
      setLoading(false);
    }
  }, [teamMode, selectedProjectId]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) validateAndSetFile(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) validateAndSetFile(file);
  };

  const validateAndSetFile = (file: File) => {
    setUploadError("");
    if (file.size > MAX_FILE_SIZE) {
      setUploadError("File exceeds 10MB limit.");
      return;
    }
    setUploadFile(file);
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploadError("");

    if (!uploadFile) {
      setUploadError("Please select a file.");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", uploadFile);
      formData.append("doc_type", uploadDocType);
      if (uploadProject) formData.append("project_id", uploadProject);
      if (uploadExpiry) formData.append("expiry_date", uploadExpiry);
      if (uploadTags) formData.append("tags", uploadTags);
      if (teamMode) formData.append("team", "true");

      const res = await fetch("/api/founders-space/documents", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        setUploadError(data.error || "Failed to upload document");
        return;
      }

      // Reset form
      setUploadFile(null);
      setUploadDocType("other");
      setUploadExpiry("");
      setUploadTags("");
      setUploadProject("");
      setShowUpload(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      fetchDocuments();
    } catch {
      setUploadError("Failed to upload document");
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (id: string) => {
    setDownloadingId(id);
    try {
      const res = await fetch(`/api/founders-space/documents/${id}`);
      if (!res.ok) throw new Error("Failed to get download URL");
      const data = await res.json();
      window.open(data.url, "_blank");
    } catch (err) {
      console.error("Download failed:", err);
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/founders-space/documents/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setDocuments((prev) => prev.filter((d) => d.id !== id));
      }
    } catch (err) {
      console.error("Failed to delete document:", err);
    } finally {
      setDeleteLoading(false);
      setDeleteId(null);
    }
  };

  const formatDate = (d: string) => {
    return new Date(d).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 size={24} className="text-terracotta animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText size={18} className="text-terracotta" />
          <h3 className="font-display text-lg text-charcoal">Documents</h3>
          <span className="text-xs text-muted bg-cream-dark px-2 py-0.5 rounded-full">
            Supabase Storage
          </span>
        </div>
        {(!teamMode || canWrite) && (
          <button
            onClick={() => setShowUpload(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-terracotta text-white text-sm font-semibold hover:bg-terracotta/90 transition-all"
          >
            <Upload size={16} />
            Upload Document{teamMode ? " (Team)" : ""}
          </button>
        )}
      </div>

      {/* Empty state */}
      {documents.length === 0 && !showUpload ? (
        <div className="bg-ivory rounded-2xl border border-sand/60 p-8 text-center space-y-3">
          <div className="w-12 h-12 rounded-xl bg-terracotta/10 flex items-center justify-center mx-auto">
            <FileText size={24} className="text-terracotta" />
          </div>
          <h3 className="font-display text-lg text-charcoal">
            No documents yet
          </h3>
          <p className="text-sm text-muted max-w-sm mx-auto">
            Upload agreements, certificates, invoices, and other files.
            Documents are stored securely in private storage.
          </p>
        </div>
      ) : (
        /* Documents table */
        !showUpload && (
          <div className="bg-ivory rounded-2xl border border-sand/60 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-sand/60 bg-cream/50">
                    <th className="text-left px-4 py-3 font-medium text-muted text-xs uppercase tracking-wider">
                      Filename
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-muted text-xs uppercase tracking-wider">
                      Type
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-muted text-xs uppercase tracking-wider">
                      Expiry
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-muted text-xs uppercase tracking-wider">
                      Size
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-muted text-xs uppercase tracking-wider">
                      Uploaded
                    </th>
                    <th className="text-right px-4 py-3 font-medium text-muted text-xs uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map((doc) => {
                    const typeBadge =
                      DOC_TYPE_BADGES[doc.doc_type] || DOC_TYPE_BADGES.other;
                    const expiryStatus = getExpiryStatus(doc.expiry_date);
                    return (
                      <tr
                        key={doc.id}
                        className="border-b border-sand/30 last:border-b-0 hover:bg-cream/30 transition-colors"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <FileIcon
                              size={14}
                              className="text-muted flex-shrink-0"
                            />
                            <span className="font-medium text-charcoal truncate max-w-[200px]">
                              {doc.filename}
                            </span>
                          </div>
                          {doc.tags && doc.tags.length > 0 && (
                            <div className="flex gap-1 mt-1 flex-wrap">
                              {doc.tags.map((tag) => (
                                <span
                                  key={tag}
                                  className="text-[10px] px-1.5 py-0.5 rounded bg-cream-dark text-muted"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${typeBadge.bg} ${typeBadge.text}`}
                          >
                            {typeBadge.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {doc.expiry_date ? (
                            <span
                              className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                                expiryStatus === "expired"
                                  ? "bg-red-100 text-red-700"
                                  : expiryStatus === "warning"
                                    ? "bg-amber-100 text-amber-700"
                                    : "bg-gray-100 text-gray-600"
                              }`}
                            >
                              {expiryStatus === "expired" && (
                                <AlertTriangle size={10} />
                              )}
                              {expiryStatus === "warning" && (
                                <Clock size={10} />
                              )}
                              {formatDate(doc.expiry_date)}
                            </span>
                          ) : (
                            <span className="text-muted text-xs">--</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted text-xs">
                          {formatFileSize(doc.file_size)}
                        </td>
                        <td className="px-4 py-3 text-muted text-xs">
                          {formatDate(doc.created_at)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleDownload(doc.id)}
                              disabled={downloadingId === doc.id}
                              className="p-1.5 rounded-lg hover:bg-cream-dark transition-colors text-muted hover:text-charcoal disabled:opacity-50"
                              title="Download"
                            >
                              {downloadingId === doc.id ? (
                                <Loader2
                                  size={14}
                                  className="animate-spin"
                                />
                              ) : (
                                <Download size={14} />
                              )}
                            </button>
                            {deleteId === doc.id ? (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => handleDelete(doc.id)}
                                  disabled={deleteLoading}
                                  className="px-2 py-1 rounded-lg bg-red-100 text-red-700 text-xs font-medium hover:bg-red-200 transition-colors disabled:opacity-50"
                                >
                                  {deleteLoading ? (
                                    <Loader2
                                      size={12}
                                      className="animate-spin"
                                    />
                                  ) : (
                                    "Confirm"
                                  )}
                                </button>
                                <button
                                  onClick={() => setDeleteId(null)}
                                  className="p-1 rounded-lg hover:bg-cream-dark transition-colors text-muted"
                                >
                                  <X size={12} />
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setDeleteId(doc.id)}
                                className="p-1.5 rounded-lg hover:bg-red-50 transition-colors text-muted hover:text-red-600"
                                title="Delete"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {/* Upload area / modal */}
      {showUpload && (
        <div className="bg-ivory rounded-2xl border border-sand/60 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-display text-base text-charcoal">
              Upload Document
            </h4>
            <button
              onClick={() => {
                setShowUpload(false);
                setUploadFile(null);
                setUploadError("");
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
              className="p-1 rounded-lg hover:bg-cream-dark transition-colors text-muted"
            >
              <X size={18} />
            </button>
          </div>

          {uploadError && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-xl">
              <AlertTriangle size={14} />
              {uploadError}
            </div>
          )}

          <form onSubmit={handleUpload} className="space-y-4">
            {/* Dropzone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleFileDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                dragOver
                  ? "border-terracotta bg-terracotta/5"
                  : uploadFile
                    ? "border-emerald-300 bg-emerald-50/30"
                    : "border-sand/60 hover:border-terracotta/40 hover:bg-cream/50"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileSelect}
                className="hidden"
              />
              {uploadFile ? (
                <div className="space-y-2">
                  <FileIcon size={28} className="text-emerald-600 mx-auto" />
                  <p className="text-sm font-medium text-charcoal">
                    {uploadFile.name}
                  </p>
                  <p className="text-xs text-muted">
                    {formatFileSize(uploadFile.size)} — Click to change
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload size={28} className="text-muted mx-auto" />
                  <p className="text-sm text-charcoal font-medium">
                    Drop a file here or click to select
                  </p>
                  <p className="text-xs text-muted">Max file size: 10MB</p>
                </div>
              )}
            </div>

            {/* Metadata fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-charcoal mb-1">
                  Document Type
                </label>
                <select
                  value={uploadDocType}
                  onChange={(e) => setUploadDocType(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-sand/60 bg-cream text-charcoal text-sm focus:outline-none focus:ring-2 focus:ring-terracotta/30 focus:border-terracotta/50"
                >
                  <option value="other">Other</option>
                  <option value="agreement">Agreement</option>
                  <option value="certificate">Certificate</option>
                  <option value="invoice">Invoice</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-charcoal mb-1">
                  Expiry Date{" "}
                  <span className="text-muted font-normal">(optional)</span>
                </label>
                <input
                  type="date"
                  value={uploadExpiry}
                  onChange={(e) => setUploadExpiry(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-sand/60 bg-cream text-charcoal text-sm focus:outline-none focus:ring-2 focus:ring-terracotta/30 focus:border-terracotta/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-charcoal mb-1">
                  Tags{" "}
                  <span className="text-muted font-normal">
                    (comma-separated, optional)
                  </span>
                </label>
                <input
                  type="text"
                  value={uploadTags}
                  onChange={(e) => setUploadTags(e.target.value)}
                  placeholder="e.g. legal, 2026, vendor"
                  className="w-full px-3 py-2 rounded-xl border border-sand/60 bg-cream text-charcoal text-sm placeholder:text-muted/50 focus:outline-none focus:ring-2 focus:ring-terracotta/30 focus:border-terracotta/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-charcoal mb-1">
                  Project{" "}
                  <span className="text-muted font-normal">(optional)</span>
                </label>
                <select
                  value={uploadProject}
                  onChange={(e) => setUploadProject(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-sand/60 bg-cream text-charcoal text-sm focus:outline-none focus:ring-2 focus:ring-terracotta/30 focus:border-terracotta/50"
                >
                  <option value="">Common (no project)</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowUpload(false);
                  setUploadFile(null);
                  setUploadError("");
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
                className="flex-1 px-4 py-2.5 rounded-xl border border-sand/60 text-sm font-medium text-muted hover:bg-cream-dark transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={uploading || !uploadFile}
                className="flex-1 px-4 py-2.5 rounded-xl bg-terracotta text-white text-sm font-semibold hover:bg-terracotta/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {uploading && <Loader2 size={14} className="animate-spin" />}
                Upload
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
