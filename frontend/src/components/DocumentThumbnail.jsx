import { useState, useEffect, useRef } from 'react';
import { FileText, Image, File } from 'lucide-react';

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

// Lazy-load PDF.js only when needed
let pdfjsPromise = null;
function getPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import('pdfjs-dist').then(mod => {
      mod.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/build/pdf.worker.mjs',
        import.meta.url
      ).toString();
      return mod;
    });
  }
  return pdfjsPromise;
}

export default function DocumentThumbnail({ doc, size = 'sm' }) {
  const [thumbUrl, setThumbUrl] = useState(null);
  const [failed, setFailed] = useState(false);
  const canvasRef = useRef(null);

  const sizeClasses = size === 'lg' ? 'w-full h-full' : size === 'md' ? 'w-14 h-14' : 'w-10 h-10';

  useEffect(() => {
    if (!doc) return;

    if (IMAGE_TYPES.includes(doc.mime_type)) {
      // Fetch image thumbnail from backend
      const token = localStorage.getItem('token');
      fetch(`/api/documents/${doc.id}/thumbnail`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(res => {
          if (!res.ok) throw new Error('Failed');
          return res.blob();
        })
        .then(blob => setThumbUrl(URL.createObjectURL(blob)))
        .catch(() => setFailed(true));
    } else if (doc.mime_type === 'application/pdf') {
      // Render PDF first page on canvas
      renderPdfThumbnail();
    } else {
      setFailed(true);
    }

    return () => {
      if (thumbUrl) URL.revokeObjectURL(thumbUrl);
    };
  }, [doc?.id]);

  const renderPdfThumbnail = async () => {
    try {
      const pdfjsLib = await getPdfjs();
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/documents/${doc.id}/download`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch PDF');
      const data = await res.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data }).promise;
      const page = await pdf.getPage(1);

      const targetSize = size === 'lg' ? 400 : size === 'sm' ? 80 : 112;
      const viewport = page.getViewport({ scale: 1 });
      const scale = targetSize / Math.min(viewport.width, viewport.height);
      const scaledViewport = page.getViewport({ scale });

      const canvas = document.createElement('canvas');
      canvas.width = targetSize;
      canvas.height = targetSize;
      const ctx = canvas.getContext('2d');

      // Center crop
      const offsetX = (targetSize - scaledViewport.width) / 2;
      const offsetY = 0;

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, targetSize, targetSize);

      await page.render({
        canvasContext: ctx,
        viewport: scaledViewport,
        transform: [1, 0, 0, 1, offsetX, offsetY],
      }).promise;

      setThumbUrl(canvas.toDataURL('image/webp', 0.7));
    } catch (err) {
      setFailed(true);
    }
  };

  if (failed || !doc) {
    return <FallbackIcon doc={doc} className={sizeClasses} />;
  }

  if (!thumbUrl) {
    // Loading state
    return (
      <div className={`${sizeClasses} rounded-lg bg-slate-100 animate-pulse flex-shrink-0`} />
    );
  }

  return (
    <img
      src={thumbUrl}
      alt={doc.name}
      className={`${sizeClasses} ${size === 'lg' ? 'rounded-none object-contain' : 'rounded-lg object-cover border border-slate-200'} flex-shrink-0`}
    />
  );
}

function FallbackIcon({ doc, className }) {
  const categoryColors = {
    ID: 'bg-blue-50 text-blue-600',
    Insurance: 'bg-purple-50 text-purple-600',
    Medical: 'bg-red-50 text-red-600',
    Financial: 'bg-green-50 text-green-600',
    Education: 'bg-amber-50 text-amber-600',
    Other: 'bg-slate-50 text-slate-500',
  };
  const colorClass = categoryColors[doc?.category] || categoryColors.Other;

  let Icon = FileText;
  if (doc?.mime_type?.startsWith('image/')) Icon = Image;
  else if (doc?.mime_type === 'application/pdf') Icon = File;

  return (
    <div className={`${className} rounded-lg flex items-center justify-center flex-shrink-0 ${colorClass}`}>
      <Icon className="w-1/2 h-1/2" />
    </div>
  );
}
