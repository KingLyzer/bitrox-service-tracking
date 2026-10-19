// exportHelpers.js - Export maintenance reports and handover signature sheets to CSV and Excel

const escapeXml = (val) => String(val || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;');

// 1. Resmi Bakım Teslim & İmza Tutanağı (İşletme Müdürü ve Teknisyen İmzalı Excel)
export function exportMaintenanceHandoverExcel(plan, items) {
  if (!plan || !items) return;

  const total = items.length;
  const completed = items.filter(i => i.status === 'Tamamlandı').length;
  const techName = plan.lead_technician || '';
  const managerName = plan.manager_name || '';

  let xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Center"/>
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Color="#000000"/>
  </Style>
  <Style ss:ID="DocTitle">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Segoe UI" ss:Size="14" ss:Bold="1" ss:Color="#0f172a"/>
  </Style>
  <Style ss:ID="DocSubtitle">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Color="#64748b"/>
  </Style>
  <Style ss:ID="MetaLabel">
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Bold="1" ss:Color="#334155"/>
  </Style>
  <Style ss:ID="MetaValue">
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Color="#0f172a"/>
  </Style>
  <Style ss:ID="TblHeader">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#475569"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#475569"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#475569"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#475569"/>
   </Borders>
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Bold="1" ss:Color="#ffffff"/>
   <Interior ss:Color="#1e293b" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="TblCell">
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#cbd5e1"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#cbd5e1"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#cbd5e1"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#cbd5e1"/>
   </Borders>
   <Font ss:FontName="Segoe UI" ss:Size="9.5" ss:Color="#1e293b"/>
  </Style>
  <Style ss:ID="TblCellCenter">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#cbd5e1"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#cbd5e1"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#cbd5e1"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#cbd5e1"/>
   </Borders>
   <Font ss:FontName="Segoe UI" ss:Size="9.5" ss:Color="#1e293b"/>
  </Style>
  <Style ss:ID="TblCellDone">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#cbd5e1"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#cbd5e1"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#cbd5e1"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#cbd5e1"/>
   </Borders>
   <Font ss:FontName="Segoe UI" ss:Size="9.5" ss:Bold="1" ss:Color="#166534"/>
   <Interior ss:Color="#dcfce7" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="SigBoxHeader">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Segoe UI" ss:Size="11" ss:Bold="1" ss:Color="#0f172a"/>
   <Interior ss:Color="#f1f5f9" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#94a3b8"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#94a3b8"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#94a3b8"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#94a3b8"/>
   </Borders>
  </Style>
  <Style ss:ID="SigBoxContent">
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Color="#334155"/>
   <Borders>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#94a3b8"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#94a3b8"/>
   </Borders>
  </Style>
  <Style ss:ID="SigBoxBottom">
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Color="#334155"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#94a3b8"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#94a3b8"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#94a3b8"/>
   </Borders>
  </Style>
 </Styles>
 <Worksheet ss:Name="İmza Tutanağı">
  <Table>
   <Column ss:Width="40"/>
   <Column ss:Width="160"/>
   <Column ss:Width="200"/>
   <Column ss:Width="240"/>
   <Column ss:Width="130"/>
   
   <Row ss:Height="26">
    <Cell ss:MergeAcross="4" ss:StyleID="DocTitle"><Data ss:Type="String">PERİYODİK BAKIM TESLİM VE ONAY TUTANAĞI</Data></Cell>
   </Row>
   <Row ss:Height="18">
    <Cell ss:MergeAcross="4" ss:StyleID="DocSubtitle"><Data ss:Type="String">BİLGİ TEKNOLOJİLERİ BAKIM YÖNETİM SİSTEMİ</Data></Cell>
   </Row>
   <Row></Row>

   <Row ss:Height="20">
    <Cell ss:Index="1" ss:MergeAcross="1" ss:StyleID="MetaLabel"><Data ss:Type="String">Şirket / İşletme:</Data></Cell>
    <Cell ss:Index="3" ss:StyleID="MetaValue"><Data ss:Type="String">${escapeXml(plan.company_name)}</Data></Cell>
    <Cell ss:Index="4" ss:StyleID="MetaLabel"><Data ss:Type="String">Bakım Dönemi:</Data></Cell>
    <Cell ss:Index="5" ss:StyleID="MetaValue"><Data ss:Type="String">${escapeXml(plan.period)}</Data></Cell>
   </Row>
   <Row ss:Height="20">
    <Cell ss:Index="1" ss:MergeAcross="1" ss:StyleID="MetaLabel"><Data ss:Type="String">Plan Tarihi:</Data></Cell>
    <Cell ss:Index="3" ss:StyleID="MetaValue"><Data ss:Type="String">${escapeXml(plan.planned_date || '')}</Data></Cell>
    <Cell ss:Index="4" ss:StyleID="MetaLabel"><Data ss:Type="String">Bakım Durumu:</Data></Cell>
    <Cell ss:Index="5" ss:StyleID="MetaValue"><Data ss:Type="String">${escapeXml(plan.status)} (${completed} / ${total} Cihaz)</Data></Cell>
   </Row>
   <Row></Row>

   <Row ss:Height="22">
    <Cell ss:StyleID="TblHeader"><Data ss:Type="String">#</Data></Cell>
    <Cell ss:StyleID="TblHeader"><Data ss:Type="String">Envanter No (Barkod)</Data></Cell>
    <Cell ss:StyleID="TblHeader"><Data ss:Type="String">Cihaz Tanımı / Model</Data></Cell>
    <Cell ss:StyleID="TblHeader"><Data ss:Type="String">Zimmetli Personel (Adı Soyadı)</Data></Cell>
    <Cell ss:StyleID="TblHeader"><Data ss:Type="String">Bakım Durumu</Data></Cell>
   </Row>`;

  items.forEach((item, idx) => {
    const isDone = item.status === 'Tamamlandı';
    xml += `
   <Row ss:Height="19">
    <Cell ss:StyleID="TblCellCenter"><Data ss:Type="Number">${idx + 1}</Data></Cell>
    <Cell ss:StyleID="TblCell"><Data ss:Type="String">${escapeXml(item.asset_tag)}</Data></Cell>
    <Cell ss:StyleID="TblCell"><Data ss:Type="String">${escapeXml(item.model_name || item.asset_name)}</Data></Cell>
    <Cell ss:StyleID="TblCell"><Data ss:Type="String">${escapeXml(item.assigned_user || '— (Ortak Alan)')}</Data></Cell>
    <Cell ss:StyleID="${isDone ? 'TblCellDone' : 'TblCellCenter'}"><Data ss:Type="String">${isDone ? '✓ Tamamlandı' : 'Bekliyor'}</Data></Cell>
   </Row>`;
  });

  // Official Signature Footer Box (Left: Cols 1-3, Right: Cols 4-5)
  xml += `
   <Row></Row>
   <Row></Row>
   <Row ss:Height="24">
    <Cell ss:Index="1" ss:MergeAcross="2" ss:StyleID="SigBoxHeader"><Data ss:Type="String">BAKIMI YAPAN TEKNİK SERVİS PERSONELİ</Data></Cell>
    <Cell ss:Index="4" ss:MergeAcross="1" ss:StyleID="SigBoxHeader"><Data ss:Type="String">İŞLETME / BİRİM MÜDÜRÜ</Data></Cell>
   </Row>
   <Row ss:Height="22">
    <Cell ss:Index="1" ss:MergeAcross="2" ss:StyleID="SigBoxContent"><Data ss:Type="String">  Adı Soyadı: ${escapeXml(techName)}</Data></Cell>
    <Cell ss:Index="4" ss:MergeAcross="1" ss:StyleID="SigBoxContent"><Data ss:Type="String">  Adı Soyadı: ${escapeXml(managerName)}</Data></Cell>
   </Row>
   <Row ss:Height="22">
    <Cell ss:Index="1" ss:MergeAcross="2" ss:StyleID="SigBoxContent"><Data ss:Type="String">  Tarih: ${escapeXml(plan.planned_date || '')}</Data></Cell>
    <Cell ss:Index="4" ss:MergeAcross="1" ss:StyleID="SigBoxContent"><Data ss:Type="String">  Tarih: ${escapeXml(plan.planned_date || '')}</Data></Cell>
   </Row>
   <Row ss:Height="40">
    <Cell ss:Index="1" ss:MergeAcross="2" ss:StyleID="SigBoxBottom"><Data ss:Type="String">  İmza: </Data></Cell>
    <Cell ss:Index="4" ss:MergeAcross="1" ss:StyleID="SigBoxBottom"><Data ss:Type="String">  İmza: </Data></Cell>
   </Row>
  </Table>
 </Worksheet>
</Workbook>`;

  const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  const safeTitle = (plan.company_name || 'bakim_tutanağı').replace(/[^a-zA-Z0-9_\-]/g, '_');
  link.setAttribute('download', `Periyodik_Bakim_Tutanagi_${safeTitle}_${new Date().toISOString().slice(0, 10)}.xls`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// 2. Detaylı Teknik Kontrol Raporu (11 Madde Kontrol Listesiyle Birlikte)
export function exportMaintenanceExcel(plan, items) {
  if (!plan || !items) return;

  const total = items.length;
  const completed = items.filter(i => i.status === 'Tamamlandı').length;
  const techName = plan.lead_technician || '';
  const managerName = plan.manager_name || '';

  let xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Center"/>
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Color="#000000"/>
  </Style>
  <Style ss:ID="Title">
   <Font ss:FontName="Segoe UI" ss:Size="14" ss:Bold="1" ss:Color="#0f172a"/>
  </Style>
  <Style ss:ID="Header">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#94a3b8"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#94a3b8"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#94a3b8"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#94a3b8"/>
   </Borders>
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Bold="1" ss:Color="#ffffff"/>
   <Interior ss:Color="#1e293b" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="Cell">
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#e2e8f0"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#e2e8f0"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#e2e8f0"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#e2e8f0"/>
   </Borders>
  </Style>
  <Style ss:ID="CellCenter">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#e2e8f0"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#e2e8f0"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#e2e8f0"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#e2e8f0"/>
   </Borders>
  </Style>
  <Style ss:ID="StatusDone">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#e2e8f0"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#e2e8f0"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#e2e8f0"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#e2e8f0"/>
   </Borders>
   <Font ss:FontName="Segoe UI" ss:Bold="1" ss:Color="#15803d"/>
   <Interior ss:Color="#dcfce7" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="StatusPending">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#e2e8f0"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#e2e8f0"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#e2e8f0"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#e2e8f0"/>
   </Borders>
   <Font ss:FontName="Segoe UI" ss:Bold="1" ss:Color="#b45309"/>
   <Interior ss:Color="#fef3c7" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="SigBoxHeader">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Segoe UI" ss:Size="11" ss:Bold="1" ss:Color="#0f172a"/>
   <Interior ss:Color="#f1f5f9" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#94a3b8"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#94a3b8"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#94a3b8"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#94a3b8"/>
   </Borders>
  </Style>
  <Style ss:ID="SigBoxContent">
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Color="#334155"/>
   <Borders>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#94a3b8"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#94a3b8"/>
   </Borders>
  </Style>
  <Style ss:ID="SigBoxBottom">
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Color="#334155"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#94a3b8"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#94a3b8"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#94a3b8"/>
   </Borders>
  </Style>
 </Styles>
 <Worksheet ss:Name="Detaylı Bakım Raporu">
  <Table>
   <Column ss:Width="35"/>
   <Column ss:Width="110"/>
   <Column ss:Width="130"/>
   <Column ss:Width="120"/>
   <Column ss:Width="140"/>
   <Column ss:Width="110"/>
   <Column ss:Width="90"/>
   <Column ss:Width="65"/>
   <Column ss:Width="65"/>
   <Column ss:Width="65"/>
   <Column ss:Width="65"/>
   <Column ss:Width="65"/>
   <Column ss:Width="65"/>
   <Column ss:Width="65"/>
   <Column ss:Width="65"/>
   <Column ss:Width="75"/>
   <Column ss:Width="65"/>
   <Column ss:Width="65"/>
   <Column ss:Width="130"/>
   <Column ss:Width="110"/>
   <Column ss:Width="160"/>
   
   <Row>
    <Cell ss:StyleID="Title"><Data ss:Type="String">PERİYODİK BAKIM RAPORU: ${escapeXml(plan.title)}</Data></Cell>
   </Row>
   <Row>
    <Cell><Data ss:Type="String">Şirket / İşletme: ${escapeXml(plan.company_name)}</Data></Cell>
    <Cell><Data ss:Type="String">Dönem: ${escapeXml(plan.period)}</Data></Cell>
    <Cell><Data ss:Type="String">Tarih: ${escapeXml(plan.planned_date)}</Data></Cell>
    <Cell><Data ss:Type="String">Durum: ${escapeXml(plan.status)}</Data></Cell>
    <Cell><Data ss:Type="String">Tamamlanan: ${completed} / ${total}</Data></Cell>
   </Row>
   <Row></Row>
   
   <Row ss:Height="24">
    <Cell ss:StyleID="Header"><Data ss:Type="String">#</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Envanter No</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Model</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Seri No</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Zimmetli Kullanıcı</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Lokasyon</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Durum</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Toz</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Fan</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Görsel/Ses</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Performans</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Portlar</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Antivirüs</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Lisans</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Network</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Yazılımlar</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Klavye/M.</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Yazıcı/D.</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Teknisyen / Yönetici</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Tarih</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Teknik Notlar</Data></Cell>
   </Row>`;

  items.forEach((item, idx) => {
    const isDone = item.status === 'Tamamlandı';
    xml += `
   <Row>
    <Cell ss:StyleID="CellCenter"><Data ss:Type="Number">${idx + 1}</Data></Cell>
    <Cell ss:StyleID="Cell"><Data ss:Type="String">${escapeXml(item.asset_tag)}</Data></Cell>
    <Cell ss:StyleID="Cell"><Data ss:Type="String">${escapeXml(item.model_name || item.asset_name)}</Data></Cell>
    <Cell ss:StyleID="Cell"><Data ss:Type="String">${escapeXml(item.serial_no)}</Data></Cell>
    <Cell ss:StyleID="Cell"><Data ss:Type="String">${escapeXml(item.assigned_user || '— (Ortak Alan)')}</Data></Cell>
    <Cell ss:StyleID="Cell"><Data ss:Type="String">${escapeXml(item.location_name)}</Data></Cell>
    <Cell ss:StyleID="${isDone ? 'StatusDone' : 'StatusPending'}"><Data ss:Type="String">${escapeXml(item.status)}</Data></Cell>
    <Cell ss:StyleID="CellCenter"><Data ss:Type="String">${item.check_dust ? '✓' : '—'}</Data></Cell>
    <Cell ss:StyleID="CellCenter"><Data ss:Type="String">${item.check_fan ? '✓' : '—'}</Data></Cell>
    <Cell ss:StyleID="CellCenter"><Data ss:Type="String">${item.check_visual_audio ? '✓' : '—'}</Data></Cell>
    <Cell ss:StyleID="CellCenter"><Data ss:Type="String">${item.check_performance ? '✓' : '—'}</Data></Cell>
    <Cell ss:StyleID="CellCenter"><Data ss:Type="String">${item.check_ports ? '✓' : '—'}</Data></Cell>
    <Cell ss:StyleID="CellCenter"><Data ss:Type="String">${item.check_antivirus ? '✓' : '—'}</Data></Cell>
    <Cell ss:StyleID="CellCenter"><Data ss:Type="String">${item.check_license ? '✓' : '—'}</Data></Cell>
    <Cell ss:StyleID="CellCenter"><Data ss:Type="String">${item.check_network ? '✓' : '—'}</Data></Cell>
    <Cell ss:StyleID="CellCenter"><Data ss:Type="String">${item.check_standard_software ? '✓' : '—'}</Data></Cell>
    <Cell ss:StyleID="CellCenter"><Data ss:Type="String">${item.check_keyboard_mouse ? '✓' : '—'}</Data></Cell>
    <Cell ss:StyleID="CellCenter"><Data ss:Type="String">${item.check_printer_drum ? '✓' : '—'}</Data></Cell>
    <Cell ss:StyleID="Cell"><Data ss:Type="String">${escapeXml(item.tech_name)}</Data></Cell>
    <Cell ss:StyleID="CellCenter"><Data ss:Type="String">${item.completed_at ? String(item.completed_at).slice(0, 16).replace('T', ' ') : ''}</Data></Cell>
    <Cell ss:StyleID="Cell"><Data ss:Type="String">${escapeXml(item.notes)}</Data></Cell>
   </Row>`;
  });

  // Official Signature Footer Box
  xml += `
   <Row></Row>
   <Row></Row>
   <Row ss:Height="22">
    <Cell ss:MergeAcross="4" ss:StyleID="SigBoxHeader"><Data ss:Type="String">BAKIMI YAPAN TEKNİK SERVİS PERSONELİ</Data></Cell>
    <Cell><Data ss:Type="String"></Data></Cell>
    <Cell ss:MergeAcross="4" ss:StyleID="SigBoxHeader"><Data ss:Type="String">İŞLETME / BİRİM MÜDÜRÜ</Data></Cell>
   </Row>
   <Row ss:Height="20">
    <Cell ss:MergeAcross="4" ss:StyleID="SigBoxContent"><Data ss:Type="String">  Adı Soyadı: ${escapeXml(techName)}</Data></Cell>
    <Cell><Data ss:Type="String"></Data></Cell>
    <Cell ss:MergeAcross="4" ss:StyleID="SigBoxContent"><Data ss:Type="String">  Adı Soyadı: ${escapeXml(managerName)}</Data></Cell>
   </Row>
   <Row ss:Height="20">
    <Cell ss:MergeAcross="4" ss:StyleID="SigBoxContent"><Data ss:Type="String">  Tarih: ${escapeXml(plan.planned_date || '')}</Data></Cell>
    <Cell><Data ss:Type="String"></Data></Cell>
    <Cell ss:MergeAcross="4" ss:StyleID="SigBoxContent"><Data ss:Type="String">  Tarih: ${escapeXml(plan.planned_date || '')}</Data></Cell>
   </Row>
   <Row ss:Height="36">
    <Cell ss:MergeAcross="4" ss:StyleID="SigBoxBottom"><Data ss:Type="String">  İmza: </Data></Cell>
    <Cell><Data ss:Type="String"></Data></Cell>
    <Cell ss:MergeAcross="4" ss:StyleID="SigBoxBottom"><Data ss:Type="String">  İmza: </Data></Cell>
   </Row>
  </Table>
 </Worksheet>
</Workbook>`;

  const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  const safeTitle = (plan.title || 'bakim_raporu').replace(/[^a-zA-Z0-9_\-]/g, '_');
  link.setAttribute('download', `${safeTitle}_${new Date().toISOString().slice(0, 10)}.xls`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// 3. CSV Formatı
export function exportMaintenanceCsv(plan, items) {
  if (!plan || !items) return;

  const headers = [
    'Sıra',
    'Envanter Tag (Barkod)',
    'Model / Tanım',
    'Seri No',
    'Zimmetli Kullanıcı',
    'Lokasyon',
    'Bakım Durumu',
    'Toz Bakımı',
    'Fan Kontrolü',
    'Ses & Görsel',
    'Performans',
    'Portlar',
    'Antivirüs',
    'Lisans',
    'Network',
    'Standart Yazılımlar',
    'Klavye/Mouse',
    'Yazıcı/Drum',
    'Teknisyen / Yönetici',
    'Tamamlanma Tarihi',
    'Teknik Notlar'
  ];

  const rows = items.map((item, idx) => [
    idx + 1,
    `"${(item.asset_tag || '').replace(/"/g, '""')}"`,
    `"${(item.model_name || item.asset_name || '').replace(/"/g, '""')}"`,
    `"${(item.serial_no || '').replace(/"/g, '""')}"`,
    `"${(item.assigned_user || '').replace(/"/g, '""')}"`,
    `"${(item.location_name || '').replace(/"/g, '""')}"`,
    `"${item.status}"`,
    item.check_dust ? '"EVET"' : '"HAYIR"',
    item.check_fan ? '"EVET"' : '"HAYIR"',
    item.check_visual_audio ? '"EVET"' : '"HAYIR"',
    item.check_performance ? '"EVET"' : '"HAYIR"',
    item.check_ports ? '"EVET"' : '"HAYIR"',
    item.check_antivirus ? '"EVET"' : '"HAYIR"',
    item.check_license ? '"EVET"' : '"HAYIR"',
    item.check_network ? '"EVET"' : '"HAYIR"',
    item.check_standard_software ? '"EVET"' : '"HAYIR"',
    item.check_keyboard_mouse ? '"EVET"' : '"HAYIR"',
    item.check_printer_drum ? '"EVET"' : '"HAYIR"',
    `"${(item.tech_name || '').replace(/"/g, '""')}"`,
    `"${item.completed_at ? String(item.completed_at).slice(0, 16).replace('T', ' ') : ''}"`,
    `"${(item.notes || '').replace(/"/g, '""')}"`
  ]);

  const csvContent = '\uFEFF' + [
    [`"BAKIM FORMU: ${(plan.title || '').replace(/"/g, '""')}"`],
    [`"ŞİRKET / İŞLETME: ${(plan.company_name || '').replace(/"/g, '""')}"`, `"DÖNEM: ${(plan.period || '').replace(/"/g, '""')}"`],
    [`"PLANLANAN TARİH: ${plan.planned_date || ''}"`, `"GENEL DURUM: ${plan.status || ''}"`],
    [`"TOPLAM CİHAZ: ${items.length}"`, `"TAMAMLANAN: ${items.filter(i => i.status === 'Tamamlandı').length}"`],
    [`"TEKNİK PERSONEL: ${plan.lead_technician || ''}"`, `"İŞLETME MÜDÜRÜ: ${plan.manager_name || ''}"`],
    [],
    headers.join(';'),
    ...rows.map(r => r.join(';'))
  ].map(line => Array.isArray(line) ? line.join(';') : line).join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  const safeTitle = (plan.title || 'bakim_raporu').replace(/[^a-zA-Z0-9_\-]/g, '_');
  link.setAttribute('download', `${safeTitle}_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
