import jsPDF from "jspdf";
import html2canvas from "html2canvas-pro";

// Renders an element to a multi-page A4 PDF. html2canvas-pro supports
// modern CSS color functions like oklch() and color-mix().
export async function exportElementToPdf(el: HTMLElement, filename: string) {
  const canvas = await html2canvas(el, {
    scale: 2,
    useCORS: true,
    backgroundColor: "#ffffff",
    logging: false,
  });

  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 8;
  const imgW = pageW - margin * 2;
  const imgH = (canvas.height * imgW) / canvas.width;
  const imgData = canvas.toDataURL("image/jpeg", 0.95);

  let heightLeft = imgH;
  let position = margin;
  pdf.addImage(imgData, "JPEG", margin, position, imgW, imgH);
  heightLeft -= pageH - margin * 2;

  while (heightLeft > 0) {
    position = margin - (imgH - heightLeft);
    pdf.addPage();
    pdf.addImage(imgData, "JPEG", margin, position, imgW, imgH);
    heightLeft -= pageH - margin * 2;
  }

  pdf.save(filename);
}

// Render an array of elements — one PDF page per element (fitted to A4).
export async function exportElementsToPdf(els: HTMLElement[], filename: string) {
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 8;
  const maxW = pageW - margin * 2;
  const maxH = pageH - margin * 2;

  for (let i = 0; i < els.length; i++) {
    const canvas = await html2canvas(els[i], {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false,
    });
    // Fit within the page while preserving aspect ratio.
    const ratio = Math.min(maxW / (canvas.width / 2), maxH / (canvas.height / 2));
    const w = (canvas.width / 2) * ratio;
    const h = (canvas.height / 2) * ratio;
    const x = margin + (maxW - w) / 2;
    const y = margin;
    if (i > 0) pdf.addPage();
    pdf.addImage(canvas.toDataURL("image/jpeg", 0.95), "JPEG", x, y, w, h);
  }

  pdf.save(filename);
}