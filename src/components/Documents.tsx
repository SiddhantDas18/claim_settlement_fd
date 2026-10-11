import { useState } from 'react'
import { openDocument } from '../api'
import { dateTime, humanize } from '../format'
import type { ClaimDocument } from '../types'

const METHOD: Record<string, { cls: string; text: string }> = {
  pdf_text: { cls: 'ok', text: 'PDF text' },
  pdf_ocr: { cls: 'info', text: 'Scanned PDF · OCR' },
  image_ocr: { cls: 'info', text: 'Photo · OCR' },
  failed: { cls: 'bad', text: 'Could not read' },
}

export default function Documents({ claimId, documents, onDelete }: { claimId: number; documents: ClaimDocument[]; onDelete?: (id: number) => void }) {
  const [open, setOpen] = useState<number | null>(null)
  const [error, setError] = useState('')
  if (documents.length === 0) return <p className="muted small">No documents uploaded yet.</p>
  return (
    <div className="stack" style={{ gap: 10 }}>
      {error && <div className="notice error">{error}</div>}
      {documents.map((doc) => {
        const method = METHOD[doc.extraction_method ?? ''] ?? { cls: 'neutral', text: 'Not read' }
        return (
          <div key={doc.id} className="card" style={{ boxShadow: 'none' }}>
            <div className="card-body" style={{ gap: 8 }}>
              <div className="row">
                <strong>{doc.original_filename}</strong>
                <span className="badge neutral">{humanize(doc.doc_type)}</span>
                <span className={`badge ${method.cls}`}>{method.text}</span>
                {doc.ocr_confidence !== null && <span className="muted small">OCR confidence {(doc.ocr_confidence * 100).toFixed(0)}%</span>}
                <span className="spacer" />
                <span className="muted small">{(doc.size_bytes / 1024).toFixed(0)} KB · {dateTime(doc.uploaded_at)}</span>
              </div>
              {doc.extraction_error && <div className="notice error small">{doc.extraction_error}</div>}
              <div className="row">
                <button type="button" className="small" onClick={() => openDocument(`/api/v1/claims/${claimId}/documents/${doc.id}/file`).catch((e) => setError(e.message))}>
                  Open file
                </button>
                {doc.extracted_text && (
                  <button type="button" className="small" onClick={() => setOpen(open === doc.id ? null : doc.id)}>
                    {open === doc.id ? 'Hide extracted text' : 'Show extracted text'}
                  </button>
                )}
                {onDelete && <button type="button" className="small danger" onClick={() => onDelete(doc.id)}>Delete</button>}
              </div>
              {open === doc.id && <div className="quote">{doc.extracted_text}</div>}
            </div>
          </div>
        )
      })}
    </div>
  )
}
