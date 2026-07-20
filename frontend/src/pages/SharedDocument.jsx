import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api';
import { FileText, Download, AlertCircle } from 'lucide-react';

export default function SharedDocument() {
  const { token } = useParams();
  const [docInfo, setDocInfo] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDoc();
  }, [token]);

  const loadDoc = async () => {
    try {
      const info = await api.getSharedDocument(token);
      setDocInfo(info);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    window.open(`/api/documents/shared/${token}/download`, '_blank');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 via-white to-sage-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 via-white to-sage-50 px-4">
      <div className="w-full max-w-md animate-fade-in">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-primary-600 rounded-2xl mb-4 shadow-lg shadow-primary-200">
            <FileText className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Family Document Vault</h1>
          <p className="text-slate-500 mt-1">Shared Document</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 p-8 border border-slate-100">
          {error ? (
            <div className="text-center">
              <AlertCircle className="w-12 h-12 mx-auto text-red-400 mb-4" />
              <h2 className="text-lg font-semibold text-slate-800 mb-2">Link Unavailable</h2>
              <p className="text-slate-500">{error}</p>
            </div>
          ) : (
            <div className="text-center">
              <div className="w-16 h-16 bg-primary-50 rounded-2xl mx-auto mb-4 flex items-center justify-center">
                <FileText className="w-8 h-8 text-primary-600" />
              </div>
              <h2 className="text-lg font-semibold text-slate-800 mb-1">{docInfo?.name}</h2>
              <p className="text-sm text-slate-500 mb-1">{docInfo?.originalFilename}</p>
              <p className="text-xs text-slate-400 mb-6">
                {docInfo?.fileSize ? `${(docInfo.fileSize / 1024).toFixed(1)} KB` : ''}
                {docInfo?.mimeType ? ` · ${docInfo.mimeType}` : ''}
              </p>
              <button
                onClick={handleDownload}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-xl shadow-md shadow-primary-200 transition-all"
              >
                <Download className="w-4 h-4" /> Download
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
