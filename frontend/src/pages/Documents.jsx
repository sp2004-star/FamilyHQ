import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useFamily } from '../context/FamilyContext';
import { api } from '../api';
import DocumentThumbnail from '../components/DocumentThumbnail';
import { Upload, Search, Filter, FileText, Download, Trash2, Eye, Share2, Lock, Globe, X, ExternalLink, RotateCcw } from 'lucide-react';

const CATEGORIES = ['ID', 'Insurance', 'Medical', 'Financial', 'Education', 'Other'];

const DOCUMENT_TYPES = [
  'Aadhaar Card', 'PAN Card', 'Passport', 'Driving License', 'Voter ID',
  'Birth Certificate', 'Marksheet (10th/12th)', 'Degree Certificate',
  'Passing Certificate', 'Ration Card', 'Property Registration', 'Rent Agreement',
  'Insurance Policy', 'Vehicle RC', 'Bank Passbook/Statement',
  'Employment Offer Letter', 'Other'
];

function getExpiryBadge(expiryDate) {
  if (!expiryDate) return null;
  const days = Math.ceil((new Date(expiryDate) - new Date()) / (1000 * 60 * 60 * 24));
  if (days < 0) return { label: 'Expired', class: 'bg-red-100 text-red-700' };
  if (days <= 7) return { label: `${days}d`, class: 'bg-red-100 text-red-700' };
  if (days <= 30) return { label: `${days}d`, class: 'bg-amber-100 text-amber-700' };
  return { label: `${days}d`, class: 'bg-green-100 text-green-700' };
}

export default function Documents() {
  const { currentFamily } = useFamily();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [showShareModal, setShowShareModal] = useState(null);

  useEffect(() => {
    if (currentFamily) loadDocuments();
  }, [currentFamily]);

  const loadDocuments = async () => {
    setLoading(true);
    try {
      const docs = await api.getDocuments(currentFamily.id);
      setDocuments(docs);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const filteredDocs = documents.filter(doc => {
    if (filter !== 'all' && doc.category !== filter) return false;
    if (search && !doc.name.toLowerCase().includes(search.toLowerCase()) && !doc.document_type.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const handleDelete = async (doc) => {
    if (!confirm(`Delete "${doc.name}"? This cannot be undone.`)) return;
    try {
      await api.deleteDocument(doc.id);
      setDocuments(prev => prev.filter(d => d.id !== doc.id));
      setSelectedDoc(null);
    } catch (e) {
      alert(e.message);
    }
  };

  const handleDownload = async (doc) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/documents/${doc.id}/download`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Download failed' }));
        alert(err.error || 'Download failed');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.original_filename || doc.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert('Download failed: ' + e.message);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Documents</h1>
          <p className="text-slate-500 mt-1">{currentFamily?.name}</p>
        </div>
        <button
          onClick={() => setShowUpload(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-xl shadow-md shadow-primary-200 transition-all"
        >
          <Upload className="w-4 h-4" /> Upload Document
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
            placeholder="Search documents..."
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          <FilterBtn active={filter === 'all'} onClick={() => setFilter('all')}>All</FilterBtn>
          {CATEGORIES.map(cat => (
            <FilterBtn key={cat} active={filter === cat} onClick={() => setFilter(cat)}>{cat}</FilterBtn>
          ))}
        </div>
      </div>

      {/* Document Grid */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      ) : filteredDocs.length === 0 ? (
        <div className="text-center py-20">
          <FileText className="w-12 h-12 mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500">No documents found</p>
          <p className="text-sm text-slate-400 mt-1">Upload your first document to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filteredDocs.map(doc => (
            <DocumentCard
              key={doc.id}
              doc={doc}
              onClick={() => setSelectedDoc(doc)}
              onDownload={() => handleDownload(doc)}
              onDelete={() => handleDelete(doc)}
              onShare={() => setShowShareModal(doc)}
            />
          ))}
        </div>
      )}

      {/* Upload Modal */}
      {showUpload && (
        <UploadModal
          familyId={currentFamily.id}
          onClose={() => setShowUpload(false)}
          onUploaded={(doc) => { setDocuments(prev => [doc, ...prev]); setShowUpload(false); }}
        />
      )}

      {/* Document Detail Modal */}
      {selectedDoc && (
        <DocumentDetailModal
          doc={selectedDoc}
          onClose={() => setSelectedDoc(null)}
          onUpdated={(updated) => { setDocuments(prev => prev.map(d => d.id === updated.id ? updated : d)); setSelectedDoc(updated); }}
          onDelete={() => handleDelete(selectedDoc)}
          onDownload={() => handleDownload(selectedDoc)}
        />
      )}

      {/* External Share Modal */}
      {showShareModal && (
        <ExternalShareModal
          doc={showShareModal}
          onClose={() => setShowShareModal(null)}
        />
      )}
    </div>
  );
}

function FilterBtn({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
        active ? 'bg-primary-100 text-primary-700' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
      }`}
    >
      {children}
    </button>
  );
}

function DocumentCard({ doc, onClick, onDownload, onDelete, onShare }) {
  const badge = getExpiryBadge(doc.expiry_date);

  return (
    <div
      className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300 transition-all cursor-pointer group flex flex-col"
      onClick={onClick}
    >
      {/* Header: filename + visibility icon */}
      <div className="flex items-center gap-2 px-3 pt-3 pb-2">
        <FileText className="w-4 h-4 text-slate-400 flex-shrink-0" />
        <p className="text-sm font-medium text-slate-800 truncate flex-1" title={doc.name}>{doc.name}</p>
        {doc.visibility === 'shared' ? (
          <Globe className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
        ) : (
          <Lock className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
        )}
      </div>

      {/* Large thumbnail preview area */}
      <div className="mx-3 rounded-lg bg-slate-50 border border-slate-100 aspect-[4/3] overflow-hidden flex items-center justify-center">
        <DocumentThumbnail doc={doc} size="lg" />
      </div>

      {/* Footer: meta + actions */}
      <div className="px-3 pt-2 pb-3 mt-auto">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs font-medium">{doc.category}</span>
          {badge && <span className={`px-2 py-0.5 rounded text-xs font-medium ${badge.class}`}>{badge.label}</span>}
        </div>
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-slate-400 truncate">{doc.uploaded_by_name}</span>
          <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
            <button onClick={onDownload} className="p-1.5 hover:bg-slate-100 rounded-md" title="Download">
              <Download className="w-3.5 h-3.5 text-slate-500" />
            </button>
            <button onClick={onShare} className="p-1.5 hover:bg-slate-100 rounded-md" title="Share externally">
              <Share2 className="w-3.5 h-3.5 text-slate-500" />
            </button>
            <button onClick={onDelete} className="p-1.5 hover:bg-red-50 rounded-md" title="Delete">
              <Trash2 className="w-3.5 h-3.5 text-red-500" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function UploadModal({ familyId, onClose, onUploaded }) {
  const [file, setFile] = useState(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [documentType, setDocumentType] = useState('');
  const [customType, setCustomType] = useState('');
  const [visibility, setVisibility] = useState('private');
  const [expiryDate, setExpiryDate] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file || !name || !category) {
      setError('Please fill in all required fields');
      return;
    }
    setUploading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('familyId', familyId);
      formData.append('name', name);
      formData.append('category', category);
      formData.append('documentType', documentType === 'Other' ? (customType || 'Other') : (documentType || 'Other'));
      formData.append('visibility', visibility);
      if (expiryDate) formData.append('expiryDate', expiryDate);
      const doc = await api.uploadDocument(formData);
      onUploaded(doc);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-black/30 flex items-center justify-center p-3" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-800">Upload Document</h2>
          <button type="button" onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-3">
          {error && <div className="p-2 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}

          {/* File */}
          <div>
            <div
              className="border-2 border-dashed border-slate-200 rounded-xl px-4 py-3 text-center cursor-pointer hover:border-primary-300 hover:bg-primary-50/50 transition-all"
              onClick={() => fileInputRef.current?.click()}
            >
              {file ? (
                <p className="text-sm text-slate-700 font-medium">{file.name}</p>
              ) : (
                <div className="flex items-center justify-center gap-3">
                  <Upload className="w-5 h-5 text-slate-300" />
                  <div className="text-left">
                    <p className="text-sm text-slate-600">Click to select a file</p>
                    <p className="text-xs text-slate-400">PDF, Images, Word, Excel (max 20MB)</p>
                  </div>
                </div>
              )}
            </div>
            <input ref={fileInputRef} type="file" className="hidden" onChange={(e) => { setFile(e.target.files[0]); if (!name && e.target.files[0]) setName(e.target.files[0].name.replace(/\.[^.]+$/, '')); }} />
          </div>

          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Document Name *</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" placeholder="e.g. Aadhaar Card - Rajesh" required />
          </div>

          {/* Category + Document Type in one row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Category *</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" required>
                <option value="">Select</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Document Type</label>
              <select value={documentType} onChange={(e) => setDocumentType(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                <option value="">Select</option>
                {DOCUMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          {documentType === 'Other' && (
            <input type="text" value={customType} onChange={(e) => setCustomType(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" placeholder="Enter custom document type" />
          )}

          {/* Visibility + Expiry in one row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Visibility</label>
              <div className="flex gap-2">
                <label className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border cursor-pointer text-xs font-medium transition-all ${visibility === 'private' ? 'border-primary-300 bg-primary-50 text-primary-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                  <input type="radio" name="visibility" value="private" checked={visibility === 'private'} onChange={() => setVisibility('private')} className="hidden" />
                  <Lock className="w-3 h-3" /> Private
                </label>
                <label className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border cursor-pointer text-xs font-medium transition-all ${visibility === 'shared' ? 'border-primary-300 bg-primary-50 text-primary-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                  <input type="radio" name="visibility" value="shared" checked={visibility === 'shared'} onChange={() => setVisibility('shared')} className="hidden" />
                  <Globe className="w-3 h-3" /> Shared
                </label>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Expiry Date</label>
              <input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
          </div>

          <button
            type="submit"
            disabled={uploading}
            className="w-full py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-xl shadow-md shadow-primary-200 disabled:opacity-50 transition-all"
          >
            {uploading ? 'Uploading...' : 'Upload Document'}
          </button>
        </form>
      </div>
    </div>,
    document.body
  );
}

function DocumentDetailModal({ doc, onClose, onUpdated, onDelete, onDownload }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(doc.name);
  const [category, setCategory] = useState(doc.category);
  const [documentType, setDocumentType] = useState(doc.document_type);
  const [visibility, setVisibility] = useState(doc.visibility);
  const [expiryDate, setExpiryDate] = useState(doc.expiry_date || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await api.updateDocument(doc.id, { name, category, documentType, visibility, expiryDate: expiryDate || null });
      onUpdated(updated);
      setEditing(false);
    } catch (e) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  const badge = getExpiryBadge(doc.expiry_date);

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/30 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-800">Document Details</h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        <div className="p-6 space-y-4">
          {editing ? (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500">
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Visibility</label>
                <select value={visibility} onChange={(e) => setVisibility(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500">
                  <option value="private">Private</option>
                  <option value="shared">Shared</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Expiry Date</label>
                <input type="date" value={expiryDate ? expiryDate.split('T')[0] : ''} onChange={(e) => setExpiryDate(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
              <div className="flex gap-2">
                <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-primary-600 text-white rounded-xl text-sm font-medium">
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
                <button onClick={() => setEditing(false)} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-sm font-medium">Cancel</button>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-primary-50 rounded-xl flex items-center justify-center">
                    <FileText className="w-6 h-6 text-primary-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900">{doc.name}</h3>
                    <p className="text-sm text-slate-500">{doc.original_filename}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 pt-3">
                  <InfoItem label="Category" value={doc.category} />
                  <InfoItem label="Type" value={doc.document_type} />
                  <InfoItem label="Visibility" value={doc.visibility === 'shared' ? 'Shared with family' : 'Private'} />
                  <InfoItem label="Uploaded by" value={doc.uploaded_by_name} />
                  <InfoItem label="Size" value={`${(doc.file_size / 1024).toFixed(1)} KB`} />
                  <InfoItem label="Uploaded" value={new Date(doc.created_at).toLocaleDateString()} />
                  {doc.expiry_date && (
                    <div className="col-span-2">
                      <p className="text-xs text-slate-400">Expiry</p>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-800">{new Date(doc.expiry_date).toLocaleDateString()}</span>
                        {badge && <span className={`px-2 py-0.5 rounded text-xs font-medium ${badge.class}`}>{badge.label}</span>}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex gap-2 pt-3 border-t border-slate-100">
                <button onClick={onDownload} className="flex items-center gap-1.5 px-3 py-2 bg-primary-50 text-primary-700 rounded-xl text-sm font-medium hover:bg-primary-100">
                  <Download className="w-3.5 h-3.5" /> Download
                </button>
                <button onClick={() => setEditing(true)} className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-200">
                  <RotateCcw className="w-3.5 h-3.5" /> Edit / Renew
                </button>
                <button onClick={onDelete} className="flex items-center gap-1.5 px-3 py-2 bg-red-50 text-red-700 rounded-xl text-sm font-medium hover:bg-red-100 ml-auto">
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

function InfoItem({ label, value }) {
  return (
    <div>
      <p className="text-xs text-slate-400">{label}</p>
      <p className="text-sm font-medium text-slate-800">{value}</p>
    </div>
  );
}

function ExternalShareModal({ doc, onClose }) {
  const [shares, setShares] = useState([]);
  const [hours, setHours] = useState(24);
  const [newLink, setNewLink] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadShares();
  }, []);

  const loadShares = async () => {
    try {
      const data = await api.getDocumentShares(doc.id);
      setShares(data);
    } catch (e) {} finally { setLoading(false); }
  };

  const createShare = async () => {
    try {
      const result = await api.createExternalShare(doc.id, { expiresInHours: hours });
      setNewLink(result.shareLink);
      loadShares();
    } catch (e) { alert(e.message); }
  };

  const revokeShare = async (shareId) => {
    try {
      await api.revokeShare(shareId);
      loadShares();
    } catch (e) { alert(e.message); }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/30 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-800">External Share</h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-sm text-slate-600">Create a temporary link to share <strong>{doc.name}</strong> with anyone.</p>

          <div className="flex gap-2">
            <select value={hours} onChange={(e) => setHours(Number(e.target.value))} className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
              <option value={1}>1 hour</option>
              <option value={6}>6 hours</option>
              <option value={24}>24 hours</option>
              <option value={72}>3 days</option>
              <option value={168}>7 days</option>
            </select>
            <button onClick={createShare} className="px-4 py-2 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700">
              Generate Link
            </button>
          </div>

          {newLink && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-xl">
              <p className="text-xs text-green-700 font-medium mb-1">Link created!</p>
              <div className="flex gap-2">
                <input type="text" value={newLink} readOnly className="flex-1 px-2 py-1 text-xs bg-white border border-green-200 rounded-lg" />
                <button onClick={() => { navigator.clipboard.writeText(newLink); }} className="px-2 py-1 text-xs bg-green-600 text-white rounded-lg">Copy</button>
              </div>
            </div>
          )}

          {/* Active shares */}
          {!loading && shares.length > 0 && (
            <div>
              <p className="text-sm font-medium text-slate-700 mb-2">Active Shares</p>
              <div className="space-y-2">
                {shares.map(share => (
                  <div key={share.id} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                    <div className="text-xs">
                      <p className={share.revoked ? 'text-red-500 line-through' : 'text-slate-600'}>
                        Expires: {new Date(share.expires_at).toLocaleString()}
                      </p>
                      {share.revoked && <span className="text-red-500">Revoked</span>}
                    </div>
                    {!share.revoked && new Date(share.expires_at) > new Date() && (
                      <button onClick={() => revokeShare(share.id)} className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded">Revoke</button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
