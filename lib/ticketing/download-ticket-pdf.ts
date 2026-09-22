"use client";

/**
 * Capture a ticket DOM node and download it as a high-resolution, perfectly-sized PDF
 * without massive empty A4 margins.
 */
export async function downloadTicketPdfFromElement(
  element: HTMLElement,
  filename: string,
): Promise<void> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ]);

  const scale = 3; // 3x rendering scale for crisp typography and scannable QR code
  const canvas = await html2canvas(element, {
    scale,
    backgroundColor: "#ffffff",
    useCORS: true,
    logging: false,
    allowTaint: true,
  });

  const imgData = canvas.toDataURL("image/png");

  // Calculate pixel dimensions for the PDF matching the element size
  const elementWidth = element.offsetWidth || canvas.width / scale;
  const elementHeight = element.offsetHeight || canvas.height / scale;

  // Add neat border padding around the ticket card so edges and shadows render cleanly
  const padding = 16;
  const pdfWidth = elementWidth + padding * 2;
  const pdfHeight = elementHeight + padding * 2;

  const orientation = pdfWidth >= pdfHeight ? "landscape" : "portrait";

  const pdf = new jsPDF({
    orientation,
    unit: "px",
    format: [pdfWidth, pdfHeight],
    hotfixes: ["px_scaling"],
  });

  // White clean page background
  pdf.setFillColor(255, 255, 255);
  pdf.rect(0, 0, pdfWidth, pdfHeight, "F");

  // Center ticket on the page
  pdf.addImage(
    imgData,
    "PNG",
    padding,
    padding,
    elementWidth,
    elementHeight,
    undefined,
    "FAST",
  );

  const safeName = filename.endsWith(".pdf") ? filename : `${filename}.pdf`;
  pdf.save(safeName);
}

