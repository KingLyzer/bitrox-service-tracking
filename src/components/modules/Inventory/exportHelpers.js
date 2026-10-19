// exportHelpers.js - Export Snipe-IT Assets Inventory to Excel and CSV

const escapeXml = (val) => String(val || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;');

export function exportInventoryExcel(items = []) {
  if (!items || items.length === 0) return;

  const total = items.length;
  const assigned = items.filter(i => i.assigned_to_user_name || (i.status_name && (i.status_name.includes('Atanmış') || i.status_name.includes('Kullanıcı')))).length;
  const ready = total - assigned;

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
  <Style ss:ID="Subtitle">
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Color="#64748b"/>
  </Style>
  <Style ss:ID="Header">
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
  <Style ss:ID="Cell">
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#e2e8f0"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#e2e8f0"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#e2e8f0"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#e2e8f0"/>
   </Borders>
   <Font ss:FontName="Segoe UI" ss:Size="9.5" ss:Color="#1e293b"/>
  </Style>
  <Style ss:ID="CellCenter">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#e2e8f0"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#e2e8f0"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#e2e8f0"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#e2e8f0"/>
   </Borders>
   <Font ss:FontName="Segoe UI" ss:Size="9.5" ss:Color="#1e293b"/>
  </Style>
  <Style ss:ID="TagCell">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#e2e8f0"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#e2e8f0"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#e2e8f0"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#e2e8f0"/>
   </Borders>
   <Font ss:FontName="Segoe UI" ss:Size="9.5" ss:Bold="1" ss:Color="#1d4ed8"/>
   <Interior ss:Color="#eff6ff" ss:Pattern="Solid"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="Demirbaş Listesi">
  <Table>
   <Column ss:Width="35"/>
   <Column ss:Width="120"/>
   <Column ss:Width="140"/>
   <Column ss:Width="110"/>
   <Column ss:Width="160"/>
   <Column ss:Width="130"/>
   <Column ss:Width="170"/>
   <Column ss:Width="120"/>
   <Column ss:Width="130"/>
   
   <Row ss:Height="24">
    <Cell ss:MergeAcross="8" ss:StyleID="Title"><Data ss:Type="String">SNIPE-IT DEMİRBAŞ ENVANTER LİSTESİ</Data></Cell>
   </Row>
   <Row ss:Height="18">
    <Cell ss:MergeAcross="8" ss:StyleID="Subtitle"><Data ss:Type="String">Rapor Tarihi: ${new Date().toLocaleDateString('tr-TR')} | Toplam: ${total} Adet | Zimmetli: ${assigned} | Boşta: ${ready}</Data></Cell>
   </Row>
   <Row></Row>
   
   <Row ss:Height="22">
    <Cell ss:StyleID="Header"><Data ss:Type="String">#</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Envanter No (Barkod)</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Cihaz Adı</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Kategori</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Model</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Seri Numarası</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Zimmetli Personel</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Lokasyon</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Durum</Data></Cell>
   </Row>`;

  items.forEach((item, idx) => {
    xml += `
   <Row ss:Height="19">
    <Cell ss:StyleID="CellCenter"><Data ss:Type="Number">${idx + 1}</Data></Cell>
    <Cell ss:StyleID="TagCell"><Data ss:Type="String">${escapeXml(item.asset_tag)}</Data></Cell>
    <Cell ss:StyleID="Cell"><Data ss:Type="String">${escapeXml(item.name)}</Data></Cell>
    <Cell ss:StyleID="Cell"><Data ss:Type="String">${escapeXml(item.category_name)}</Data></Cell>
    <Cell ss:StyleID="Cell"><Data ss:Type="String">${escapeXml(item.model_name)}</Data></Cell>
    <Cell ss:StyleID="Cell"><Data ss:Type="String">${escapeXml(item.serial)}</Data></Cell>
    <Cell ss:StyleID="Cell"><Data ss:Type="String">${escapeXml(item.assigned_to_user_name || '— (Ortak Alan)')}</Data></Cell>
    <Cell ss:StyleID="Cell"><Data ss:Type="String">${escapeXml(item.location_name)}</Data></Cell>
    <Cell ss:StyleID="CellCenter"><Data ss:Type="String">${escapeXml(item.status_name)}</Data></Cell>
   </Row>`;
  });

  xml += `
  </Table>
 </Worksheet>
</Workbook>`;

  const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `SnipeIT_Demirbas_Envanteri_${new Date().toISOString().slice(0, 10)}.xls`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function exportInventoryCsv(items = []) {
  if (!items || items.length === 0) return;

  const headers = [
    'Sıra',
    'Envanter No (Barkod)',
    'Cihaz Adı',
    'Kategori',
    'Model',
    'Seri Numarası',
    'Zimmetli Personel',
    'Lokasyon',
    'Durum'
  ];

  const rows = items.map((item, idx) => [
    idx + 1,
    `"${(item.asset_tag || '').replace(/"/g, '""')}"`,
    `"${(item.name || '').replace(/"/g, '""')}"`,
    `"${(item.category_name || '').replace(/"/g, '""')}"`,
    `"${(item.model_name || '').replace(/"/g, '""')}"`,
    `"${(item.serial || '').replace(/"/g, '""')}"`,
    `"${(item.assigned_to_user_name || '').replace(/"/g, '""')}"`,
    `"${(item.location_name || '').replace(/"/g, '""')}"`,
    `"${(item.status_name || '').replace(/"/g, '""')}"`
  ]);

  const csvContent = '\uFEFF' + [
    [`"SNIPE-IT DEMİRBAŞ ENVANTER LİSTESİ"`],
    [`"Rapor Tarihi: ${new Date().toLocaleDateString('tr-TR')}"`, `"Toplam: ${items.length}"`],
    [],
    headers.join(';'),
    ...rows.map(r => r.join(';'))
  ].map(line => Array.isArray(line) ? line.join(';') : line).join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `SnipeIT_Demirbas_Envanteri_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
