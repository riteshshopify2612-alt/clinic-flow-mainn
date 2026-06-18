export type PrescriptionPdfItem = {
  medicineName: string;
  dosage: string;
  frequency: string;
  duration: string;
  quantity?: string | null;
  route?: string | null;
  notes?: string | null;
};

export type PrescriptionPdfData = {
  clinic: {
    name: string;
    logoUrl?: string | null;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
  };
  doctor: {
    name: string;
    specialization?: string | null;
    qualification?: string | null;
  };
  patient: {
    name: string;
    code: string;
    phone?: string | null;
    dateOfBirth?: string | null;
    gender?: string | null;
  };
  prescription: {
    number: string;
    date: string;
    diagnosis?: string | null;
    chiefComplaint?: string | null;
    clinicalNotes?: string | null;
    instructions?: string | null;
  };
  items: PrescriptionPdfItem[];
};

type PdfTextLine = {
  text: string;
  size?: number;
  bold?: boolean;
  gapAfter?: number;
};

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN_X = 48;
const TOP_Y = 796;
const BOTTOM_Y = 64;
const LINE_HEIGHT = 15;

export function createPrescriptionPdfBlob(data: PrescriptionPdfData) {
  const pages = paginate(buildPdfLines(data));
  const objects: string[] = [];

  objects.push("<< /Type /Catalog /Pages 2 0 R >>");

  const pageObjectNumbers = pages.map((_, index) => 5 + index * 2);
  objects.push(
    `<< /Type /Pages /Kids [${pageObjectNumbers.map((number) => `${number} 0 R`).join(" ")}] /Count ${pages.length} >>`,
  );
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");

  pages.forEach((page, index) => {
    const pageObject = pageObjectNumbers[index];
    const contentObject = pageObject + 1;
    const content = renderPage(page, index + 1, pages.length);
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentObject} 0 R >>`,
    );
    objects.push(`<< /Length ${byteLength(content)} >>\nstream\n${content}\nendstream`);
  });

  const chunks = ["%PDF-1.4\n% CURA prescription\n"];
  const offsets = [0];
  for (let index = 0; index < objects.length; index += 1) {
    offsets.push(byteLength(chunks.join("")));
    chunks.push(`${index + 1} 0 obj\n${objects[index]}\nendobj\n`);
  }

  const xrefOffset = byteLength(chunks.join(""));
  chunks.push(`xref\n0 ${objects.length + 1}\n`);
  chunks.push("0000000000 65535 f \n");
  for (const offset of offsets.slice(1)) {
    chunks.push(`${String(offset).padStart(10, "0")} 00000 n \n`);
  }
  chunks.push(
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`,
  );

  return new Blob(chunks, { type: "application/pdf" });
}

export function createPrescriptionPrintHtml(data: PrescriptionPdfData) {
  const rows = data.items
    .map(
      (item, index) => `
        <tr>
          <td>${index + 1}</td>
          <td><strong>${escapeHtml(item.medicineName)}</strong>${item.notes ? `<div>${escapeHtml(item.notes)}</div>` : ""}</td>
          <td>${escapeHtml(item.dosage)}</td>
          <td>${escapeHtml(item.frequency)}</td>
          <td>${escapeHtml(item.duration)}</td>
          <td>${escapeHtml(item.quantity ?? "-")}</td>
          <td>${escapeHtml(item.route ?? "-")}</td>
        </tr>
      `,
    )
    .join("");

  return `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <title>${escapeHtml(data.prescription.number)}</title>
      <style>
        body { font-family: Inter, Arial, sans-serif; color: #171717; margin: 32px; }
        header { display: flex; align-items: center; gap: 16px; border-bottom: 2px solid #111827; padding-bottom: 18px; }
        .logo { width: 64px; height: 64px; border-radius: 12px; border: 1px solid #d4d4d4; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 20px; overflow: hidden; }
        .logo img { width: 100%; height: 100%; object-fit: cover; }
        h1, h2, p { margin: 0; }
        h1 { font-size: 24px; }
        .muted { color: #525252; font-size: 12px; }
        .meta { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 32px; margin: 24px 0; font-size: 13px; }
        .section { margin-top: 18px; }
        .label { font-size: 10px; text-transform: uppercase; letter-spacing: .08em; color: #525252; font-weight: 700; margin-bottom: 4px; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
        th, td { border: 1px solid #d4d4d4; padding: 8px; text-align: left; vertical-align: top; }
        th { background: #f5f5f5; font-size: 10px; text-transform: uppercase; letter-spacing: .06em; }
        .signature { margin-top: 56px; text-align: right; }
        .signature-line { display: inline-block; min-width: 180px; border-top: 1px solid #171717; padding-top: 8px; }
        @media print { body { margin: 18mm; } button { display: none; } }
      </style>
    </head>
    <body>
      <button onclick="window.print()" style="position: fixed; right: 24px; top: 24px;">Print</button>
      <header>
        <div class="logo">${
          data.clinic.logoUrl
            ? `<img src="${escapeHtml(data.clinic.logoUrl)}" alt="${escapeHtml(data.clinic.name)}" />`
            : escapeHtml(initials(data.clinic.name))
        }</div>
        <div>
          <h1>${escapeHtml(data.clinic.name)}</h1>
          <p class="muted">${escapeHtml([data.clinic.address, data.clinic.phone, data.clinic.email].filter(Boolean).join(" | "))}</p>
        </div>
      </header>
      <div class="meta">
        <div>
          <div class="label">Prescription</div>
          <strong>${escapeHtml(data.prescription.number)}</strong><br />
          <span class="muted">${escapeHtml(data.prescription.date)}</span>
        </div>
        <div>
          <div class="label">Doctor</div>
          <strong>${escapeHtml(data.doctor.name)}</strong><br />
          <span class="muted">${escapeHtml([data.doctor.qualification, data.doctor.specialization].filter(Boolean).join(" | "))}</span>
        </div>
        <div>
          <div class="label">Patient</div>
          <strong>${escapeHtml(data.patient.name)}</strong><br />
          <span class="muted">${escapeHtml([data.patient.code, data.patient.phone, data.patient.gender, data.patient.dateOfBirth].filter(Boolean).join(" | "))}</span>
        </div>
      </div>
      <section class="section">
        <div class="label">Diagnosis</div>
        <p>${escapeHtml(data.prescription.diagnosis ?? "-")}</p>
      </section>
      <section class="section">
        <div class="label">Clinical Notes</div>
        <p>${escapeHtml(data.prescription.clinicalNotes ?? data.prescription.chiefComplaint ?? "-")}</p>
      </section>
      <section class="section">
        <div class="label">Medicines</div>
        <table>
          <thead>
            <tr><th>#</th><th>Medicine</th><th>Dosage</th><th>Frequency</th><th>Duration</th><th>Qty</th><th>Route</th></tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </section>
      <section class="section">
        <div class="label">Instructions</div>
        <p>${escapeHtml(data.prescription.instructions ?? "-")}</p>
      </section>
      <div class="signature">
        <div class="signature-line">${escapeHtml(data.doctor.name)}</div>
      </div>
    </body>
  </html>`;
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function buildPdfLines(data: PrescriptionPdfData): PdfTextLine[] {
  const lines: PdfTextLine[] = [
    { text: data.clinic.name, size: 20, bold: true },
    {
      text: [data.clinic.address, data.clinic.phone, data.clinic.email].filter(Boolean).join(" | "),
      size: 9,
      gapAfter: 10,
    },
    { text: `Prescription: ${data.prescription.number}`, size: 12, bold: true },
    { text: `Date: ${data.prescription.date}`, size: 10 },
    {
      text: `Doctor: ${data.doctor.name}${data.doctor.qualification ? `, ${data.doctor.qualification}` : ""}${data.doctor.specialization ? ` | ${data.doctor.specialization}` : ""}`,
      size: 10,
    },
    {
      text: `Patient: ${data.patient.name} (${data.patient.code})${data.patient.phone ? ` | ${data.patient.phone}` : ""}`,
      size: 10,
      gapAfter: 10,
    },
    { text: "Diagnosis", size: 11, bold: true },
    ...wrapText(data.prescription.diagnosis || "-", 82).map((text) => ({ text, size: 10 })),
    { text: "Clinical Notes", size: 11, bold: true, gapAfter: 0 },
    ...wrapText(data.prescription.clinicalNotes || data.prescription.chiefComplaint || "-", 82).map(
      (text) => ({ text, size: 10 }),
    ),
    { text: "Medicines", size: 11, bold: true, gapAfter: 0 },
  ];

  data.items.forEach((item, index) => {
    lines.push({
      text: `${index + 1}. ${item.medicineName} | ${item.dosage} | ${item.frequency} | ${item.duration}${item.quantity ? ` | Qty ${item.quantity}` : ""}${item.route ? ` | ${item.route}` : ""}`,
      size: 10,
      bold: true,
    });
    if (item.notes) {
      wrapText(`Notes: ${item.notes}`, 82).forEach((text) => lines.push({ text, size: 9 }));
    }
  });

  lines.push(
    { text: "Instructions", size: 11, bold: true, gapAfter: 0 },
    ...wrapText(data.prescription.instructions || "-", 82).map((text) => ({ text, size: 10 })),
    { text: "", gapAfter: 28 },
    { text: `Signature: ${data.doctor.name}`, size: 10, bold: true },
  );

  return lines;
}

function paginate(lines: PdfTextLine[]) {
  const pages: PdfTextLine[][] = [[]];
  let y = TOP_Y;

  for (const line of lines) {
    const height = (line.size ?? 10) + (line.gapAfter ?? 4);
    if (y - height < BOTTOM_Y && pages[pages.length - 1].length > 0) {
      pages.push([]);
      y = TOP_Y;
    }
    pages[pages.length - 1].push(line);
    y -= height + LINE_HEIGHT - 10;
  }

  return pages;
}

function renderPage(lines: PdfTextLine[], pageNumber: number, totalPages: number) {
  const commands = ["0.1 0.1 0.1 rg", "0.8 w"];
  let y = TOP_Y;

  commands.push(
    `0.82 0.84 0.87 RG ${MARGIN_X} ${PAGE_HEIGHT - 72} m ${PAGE_WIDTH - MARGIN_X} ${PAGE_HEIGHT - 72} l S`,
  );

  for (const line of lines) {
    const size = line.size ?? 10;
    const font = line.bold ? "F2" : "F1";
    commands.push(`BT /${font} ${size} Tf ${MARGIN_X} ${y} Td (${escapePdf(line.text)}) Tj ET`);
    y -= LINE_HEIGHT + (line.gapAfter ?? 4);
  }

  commands.push(
    `BT /F1 8 Tf ${PAGE_WIDTH - 120} 36 Td (Page ${pageNumber} of ${totalPages}) Tj ET`,
  );
  return commands.join("\n");
}

function wrapText(text: string, maxLength: number) {
  const words = text.replace(/\s+/g, " ").trim().split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxLength && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }

  if (current) lines.push(current);
  return lines.length ? lines : ["-"];
}

function escapePdf(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function initials(value: string) {
  return value
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function byteLength(value: string) {
  return new TextEncoder().encode(value).length;
}
