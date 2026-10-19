import React, { useEffect, useRef } from 'react';
import Modal from '../../common/Modal';
import JsBarcode from 'jsbarcode';

export default function CargoLabelModal({ isOpen, onClose, cargo, settings }) {
  const barcodeRef = useRef(null);

  useEffect(() => {
    if (isOpen && cargo && barcodeRef.current) {
      try {
        const barcodeText = cargo.tracking_number || `CRG-${String(cargo.id).padStart(6, '0')}`;
        JsBarcode(barcodeRef.current, barcodeText, {
          format: 'CODE128',
          width: 2,
          height: 44,
          displayValue: true,
          fontSize: 12,
          margin: 4
        });
      } catch (err) {
        console.warn('[Barcode Gen Error]:', err);
      }
    }
  }, [isOpen, cargo]);

  if (!cargo) return null;

  const isOutgoing = cargo.direction === 'outgoing';

  const handlePrint = () => {
    const printContent = document.getElementById('cargo-printable-label');
    if (!printContent) return;

    const win = window.open('', '_blank', 'width=480,height=600');
    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${isOutgoing ? 'Kargo Gönderi Etiketi' : 'Kargo Kabul Etiketi'} - #${cargo.id}</title>
          <style>
            @page {
              size: auto;
              margin: 4mm;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              margin: 0;
              padding: 6px;
              color: #000;
              background: #fff;
            }
            .label-box {
              border: 2px solid #000;
              border-radius: 6px;
              padding: 12px;
              width: 95mm;
              box-sizing: border-box;
            }
            .label-header {
              border-bottom: 2px solid #000;
              padding-bottom: 6px;
              margin-bottom: 8px;
              display: flex;
              justify-content: space-between;
              align-items: center;
            }
            .brand-title {
              font-size: 13px;
              font-weight: 800;
              text-transform: uppercase;
            }
            .cargo-tag {
              font-size: 12px;
              font-weight: 800;
              background: #000;
              color: #fff;
              padding: 2px 6px;
              border-radius: 4px;
            }
            .section-box {
              border: 1.5px solid #333;
              border-radius: 5px;
              padding: 6px 8px;
              margin-bottom: 8px;
              background: #fafafa;
            }
            .barcode-wrapper {
              text-align: center;
              margin-top: 8px;
              padding-top: 6px;
              border-top: 1px dashed #666;
            }
          </style>
        </head>
        <body>
          <div class="label-box">
            ${printContent.innerHTML}
          </div>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `);
    win.document.close();
  };

  const formattedDate = cargo.received_date 
    ? new Date(cargo.received_date).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' })
    : '—';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isOutgoing ? "🏷️ Kargo Gönderi & Çıkış Etiketi" : "🏷️ Kargo Kabul Etiketi Yazdır"}
      size="md"
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
        {/* Önizleme Etiket Kutusu */}
        <div id="cargo-printable-label" className="cargo-label-preview-box" style={{ width: '100%', maxWidth: 420 }}>
          <div className="label-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #000', paddingBottom: 6, marginBottom: 8 }}>
            <div className="brand-title" style={{ fontSize: 13, fontWeight: 800, textTransform: 'uppercase' }}>
              {settings?.brand_title || 'ÖRNEK TEKNOLOJİ'} • {isOutgoing ? 'KARGO GÖNDERİ ÇIKIŞI' : 'KARGO KABUL'}
            </div>
            <div className="cargo-tag" style={{ fontSize: 12, fontWeight: 800, background: '#000', color: '#fff', padding: '2px 6px', borderRadius: 4 }}>
              #{cargo.id}
            </div>
          </div>

          {isOutgoing ? (
            /* 📤 GİDEN KARGO ETİKETİ DÜZENİ */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
              {/* ALICI KUTUSU */}
              <div style={{ border: '2px solid #000', borderRadius: 6, padding: '8px 10px', background: '#f8fafc' }}>
                <div style={{ fontSize: 10, fontWeight: 900, textTransform: 'uppercase', color: '#000', borderBottom: '1px solid #ccc', paddingBottom: 3, marginBottom: 4, display: 'flex', justifyContent: 'space-between' }}>
                  <span>🏢 ALICI (TESLİMAT):</span>
                  {cargo.receiver_phone && <span>📞 {cargo.receiver_phone}</span>}
                </div>
                <div style={{ fontSize: 16, fontWeight: 900, color: '#000', lineHeight: 1.2 }}>
                  {cargo.recipient_name}
                </div>
                {cargo.department && (
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: '#444', marginTop: 2 }}>
                    {cargo.department}
                  </div>
                )}
                {cargo.receiver_address && (
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#000', marginTop: 4, lineHeight: 1.3 }}>
                    📍 {cargo.receiver_address}
                  </div>
                )}
              </div>

              {/* GÖNDEREN KUTUSU */}
              <div style={{ border: '1px solid #666', borderRadius: 5, padding: '6px 8px', background: '#fff' }}>
                <div style={{ fontSize: 9.5, fontWeight: 800, color: '#555', textTransform: 'uppercase' }}>
                  📦 GÖNDERİCİ:
                </div>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#000' }}>
                  {cargo.sender || 'IT Departmanı (Bilgi İşlem)'}
                </div>
                <div style={{ fontSize: 11, color: '#444' }}>
                  Yetkili: {cargo.received_by || 'IT Ekibi'}
                </div>
              </div>

              {/* KARGO DETAYLARI */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 8px', fontSize: 11.5 }}>
                <div>
                  <span style={{ fontWeight: 'bold', color: '#555' }}>Kargo:</span> <strong>{cargo.carrier}</strong>
                </div>
                <div>
                  <span style={{ fontWeight: 'bold', color: '#555' }}>Tarih:</span> {formattedDate}
                </div>
                {cargo.waybill_no && (
                  <div>
                    <span style={{ fontWeight: 'bold', color: '#555' }}>İrsaliye No:</span> <strong>{cargo.waybill_no}</strong>
                  </div>
                )}
                <div>
                  <span style={{ fontWeight: 'bold', color: '#555' }}>Paket:</span> {cargo.package_type} ({cargo.package_count || 1} Adet)
                </div>
              </div>
            </div>
          ) : (
            /* 📥 GELEN KARGO ETİKETİ DÜZENİ */
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px', fontSize: 12 }}>
              <div style={{ gridColumn: 'span 2' }}>
                <div style={{ fontSize: 10, fontWeight: 'bold', color: '#555' }}>ALICI PERSONEL:</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#000' }}>{cargo.recipient_name}</div>
              </div>

              <div>
                <div style={{ fontSize: 10, fontWeight: 'bold', color: '#555' }}>DEPARTMAN / ŞİRKET:</div>
                <div style={{ fontSize: 12, fontWeight: 700 }}>{cargo.department || '—'}</div>
              </div>

              <div>
                <div style={{ fontSize: 10, fontWeight: 'bold', color: '#555' }}>İRSALİYE NO:</div>
                <div style={{ fontSize: 12, fontWeight: 700 }}>{cargo.waybill_no || '—'}</div>
              </div>

              <div>
                <div style={{ fontSize: 10, fontWeight: 'bold', color: '#555' }}>KARGO FİRMASI:</div>
                <div style={{ fontSize: 12, fontWeight: 700 }}>{cargo.carrier}</div>
              </div>

              <div>
                <div style={{ fontSize: 10, fontWeight: 'bold', color: '#555' }}>GELİŞ TARİHİ:</div>
                <div style={{ fontSize: 12, fontWeight: 700 }}>{formattedDate}</div>
              </div>

              <div style={{ gridColumn: 'span 2' }}>
                <div style={{ fontSize: 10, fontWeight: 'bold', color: '#555' }}>PAKET İÇERİĞİ & ADET:</div>
                <div style={{ fontSize: 12, fontWeight: 700 }}>
                  {cargo.package_type} ({cargo.package_count || 1} Adet)
                  {cargo.asset_tag ? ` • [${cargo.asset_tag}]` : ''}
                </div>
              </div>

              {cargo.sender && (
                <div style={{ gridColumn: 'span 2' }}>
                  <div style={{ fontSize: 10, fontWeight: 'bold', color: '#555' }}>GÖNDEREN:</div>
                  <div style={{ fontSize: 12 }}>{cargo.sender}</div>
                </div>
              )}
            </div>
          )}

          {/* Barkod */}
          <div className="barcode-wrapper" style={{ textAlign: 'center', marginTop: 10, paddingTop: 6, borderTop: '1px dashed #888' }}>
            <svg ref={barcodeRef} style={{ maxWidth: '100%' }}></svg>
          </div>
        </div>

        <div className="modal-footer" style={{ width: '100%', display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Kapat
          </button>
          <button type="button" className="btn btn-primary" onClick={handlePrint} style={{
            background: isOutgoing ? 'linear-gradient(135deg, #f59e0b, #d97706)' : undefined,
            color: isOutgoing ? '#ffffff' : undefined,
            border: 'none',
            fontWeight: 800
          }}>
            🖨️ {isOutgoing ? 'Gönderi Etiketini Yazdır' : 'Kabul Etiketini Yazdır'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
