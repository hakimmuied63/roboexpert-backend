import PDFDocument from 'pdfkit';
import type { Response } from 'express';

type InvoiceOrder = {
  orderNumber: string;
  createdAt: Date | string;
  buyer: {
    name: string;
    email: string;
    phone: string;
  };
  shippingAddress: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    pincode: string;
    country: string;
  };
  subtotal: number;
  shippingFee: number;
  packagingFee: number;
  total: number;
  status: string;
  paymentMethod: string;
  paymentStatus: string;
  notes?: string;
};

type InvoiceItem = {
  productSnapshot: {
    name: string;
    sku: string;
    variantAttributes?: Record<string, string>;
  };
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

type InvoiceMeta = {
  sellerName: string;
  sellerEmail: string;
  sellerPhone?: string;
  sellerAddress?: string;
  gstin?: string;
};

// ---------- Helper: format currency ----------
const inr = (n: number) =>
  `Rs. ${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// ---------- Helper: format date ----------
const formatDate = (d: Date | string) => {
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

// ---------- Main: Generate and stream invoice PDF ----------

export const streamInvoicePDF = async (
  res: Response,
  order: InvoiceOrder,
  items: InvoiceItem[],
  meta: InvoiceMeta
): Promise<void> => {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });

  // Set headers for browser download
  const filename = `Invoice-${order.orderNumber}.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  doc.pipe(res);

  // ---------- Header ----------
  doc
    .fillColor('#1e293b')
    .fontSize(24)
    .font('Helvetica-Bold')
    .text('RoboExpert', 50, 50);

  doc
    .fillColor('#64748b')
    .fontSize(9)
    .font('Helvetica')
    .text("India's Open Marketplace", 50, 78);

  // ---------- Invoice title (right) ----------
  doc
    .fillColor('#1e293b')
    .fontSize(20)
    .font('Helvetica-Bold')
    .text('TAX INVOICE', 350, 50, { align: 'right', width: 195 });

  doc
    .fillColor('#64748b')
    .fontSize(9)
    .font('Helvetica')
    .text(`Invoice #: ${order.orderNumber}`, 350, 78, { align: 'right', width: 195 })
    .text(`Date: ${formatDate(order.createdAt)}`, 350, 92, { align: 'right', width: 195 });

  // ---------- Divider ----------
  doc
    .strokeColor('#e2e8f0')
    .lineWidth(1)
    .moveTo(50, 120)
    .lineTo(545, 120)
    .stroke();

  // ---------- Seller info (left) ----------
  let y = 140;
  doc
    .fillColor('#64748b')
    .fontSize(8)
    .font('Helvetica-Bold')
    .text('SOLD BY', 50, y);

  y += 14;
  doc
    .fillColor('#1e293b')
    .fontSize(11)
    .font('Helvetica-Bold')
    .text(meta.sellerName, 50, y);

  y += 16;
  doc.fontSize(9).font('Helvetica').fillColor('#475569');
  doc.text(meta.sellerEmail, 50, y);
  y += 12;

  if (meta.sellerPhone) {
    doc.text(meta.sellerPhone, 50, y);
    y += 12;
  }
  if (meta.sellerAddress) {
    doc.text(meta.sellerAddress, 50, y, { width: 200 });
    y += 24;
  }
  if (meta.gstin) {
    doc.text(`GSTIN: ${meta.gstin}`, 50, y);
  }

  // ---------- Ship to (right) ----------
  let ry = 140;
  doc
    .fillColor('#64748b')
    .fontSize(8)
    .font('Helvetica-Bold')
    .text('SHIP TO', 350, ry);

  ry += 14;
  doc
    .fillColor('#1e293b')
    .fontSize(11)
    .font('Helvetica-Bold')
    .text(order.buyer.name, 350, ry, { width: 195 });

  ry += 16;
  doc.fontSize(9).font('Helvetica').fillColor('#475569');
  doc.text(order.shippingAddress.line1, 350, ry, { width: 195 });
  ry += 12;

  if (order.shippingAddress.line2) {
    doc.text(order.shippingAddress.line2, 350, ry, { width: 195 });
    ry += 12;
  }

  doc.text(
    `${order.shippingAddress.city}, ${order.shippingAddress.state} - ${order.shippingAddress.pincode}`,
    350,
    ry,
    { width: 195 }
  );
  ry += 12;
  doc.text(order.shippingAddress.country, 350, ry);
  ry += 12;
  doc.text(`Phone: ${order.buyer.phone}`, 350, ry);
  ry += 12;
  doc.text(`Email: ${order.buyer.email}`, 350, ry);

  // ---------- Items table ----------
  const tableTop = Math.max(y, ry) + 30;

  // Table header background
  doc
    .rect(50, tableTop, 495, 24)
    .fillColor('#f1f5f9')
    .fill();

  doc.fillColor('#334155').fontSize(9).font('Helvetica-Bold');
  doc.text('ITEM', 60, tableTop + 8);
  doc.text('QTY', 350, tableTop + 8, { width: 40, align: 'right' });
  doc.text('UNIT PRICE', 400, tableTop + 8, { width: 70, align: 'right' });
  doc.text('TOTAL', 480, tableTop + 8, { width: 55, align: 'right' });

  // Table rows
  let rowY = tableTop + 30;
  doc.font('Helvetica').fontSize(9).fillColor('#1e293b');

  items.forEach((item) => {
    const attrs = item.productSnapshot.variantAttributes
      ? Object.entries(item.productSnapshot.variantAttributes)
          .map(([k, v]) => `${k}: ${v}`)
          .join(' • ')
      : '';

    // Item name
    doc.font('Helvetica-Bold').text(item.productSnapshot.name, 60, rowY, { width: 280 });

    // SKU + attributes below
    doc.font('Helvetica').fontSize(8).fillColor('#64748b');
    let subY = rowY + 12;
    if (item.productSnapshot.sku) {
      doc.text(`SKU: ${item.productSnapshot.sku}`, 60, subY, { width: 280 });
      subY += 10;
    }
    if (attrs) {
      doc.text(attrs, 60, subY, { width: 280 });
      subY += 10;
    }

    // Right-side values aligned to first row
    doc.fontSize(9).fillColor('#1e293b');
    doc.text(String(item.quantity), 350, rowY, { width: 40, align: 'right' });
    doc.text(inr(item.unitPrice), 400, rowY, { width: 70, align: 'right' });
    doc.font('Helvetica-Bold').text(inr(item.lineTotal), 480, rowY, { width: 55, align: 'right' });

    rowY = subY + 10;

    // Light divider
    doc
      .strokeColor('#f1f5f9')
      .lineWidth(1)
      .moveTo(50, rowY - 4)
      .lineTo(545, rowY - 4)
      .stroke();

    rowY += 6;
  });

  // ---------- Totals ----------
  const totalsTop = rowY + 10;

  // Subtotal
  doc.fontSize(10).font('Helvetica').fillColor('#64748b');
  doc.text('Subtotal', 380, totalsTop, { width: 100, align: 'right' });
  doc.fillColor('#1e293b').font('Helvetica-Bold');
  doc.text(inr(order.subtotal), 480, totalsTop, { width: 55, align: 'right' });

  let tY = totalsTop + 16;

  // Packaging
  if (order.packagingFee > 0) {
    doc.font('Helvetica').fillColor('#64748b');
    doc.text('Packaging', 380, tY, { width: 100, align: 'right' });
    doc.fillColor('#1e293b').font('Helvetica-Bold');
    doc.text(inr(order.packagingFee), 480, tY, { width: 55, align: 'right' });
    tY += 16;
  }

  // Shipping
  doc.font('Helvetica').fillColor('#64748b');
  doc.text('Shipping', 380, tY, { width: 100, align: 'right' });
  doc.fillColor('#1e293b').font('Helvetica-Bold');
  doc.text(order.shippingFee === 0 ? 'Free' : inr(order.shippingFee), 480, tY, {
    width: 55,
    align: 'right',
  });
  tY += 20;

  // Divider above total
  doc
    .strokeColor('#cbd5e1')
    .lineWidth(1)
    .moveTo(380, tY)
    .lineTo(535, tY)
    .stroke();

  tY += 8;

    // Grand total
    doc.fontSize(12).font('Helvetica-Bold').fillColor('#1e293b');
    doc.text('Total', 360, tY, { width: 100, align: 'right' });
    doc.fillColor('#4f46e5').fontSize(13);
    doc.text(inr(order.total), 460, tY, { width: 85, align: 'right' });

    // ---------- Status (order + payment) ----------
    const payTop = tY + 40;

    // Left column: Order status
    doc.fontSize(9).font('Helvetica-Bold').fillColor('#64748b');
    doc.text('ORDER STATUS', 50, payTop);
  
    doc.fontSize(10).font('Helvetica-Bold').fillColor('#1e293b');
    doc.text(order.status.toUpperCase(), 50, payTop + 14);
  
    // Right column: Payment info
    doc.fontSize(9).font('Helvetica-Bold').fillColor('#64748b');
    doc.text('PAYMENT', 300, payTop);
  
    doc.fontSize(10).font('Helvetica').fillColor('#1e293b');
    doc.text(
      `Method: ${order.paymentMethod === 'cod' ? 'Cash on Delivery' : 'Online (Razorpay)'}`,
      300,
      payTop + 14
    );
    doc.text(`Status: ${order.paymentStatus.toUpperCase()}`, 300, payTop + 28);

  // ---------- Footer ----------
  const footerY = 750;
  doc
    .strokeColor('#e2e8f0')
    .lineWidth(1)
    .moveTo(50, footerY)
    .lineTo(545, footerY)
    .stroke();

  doc
    .fontSize(8)
    .fillColor('#94a3b8')
    .font('Helvetica')
    .text(
      'This is a computer-generated invoice. For support, visit roboexpert.in/help',
      50,
      footerY + 10,
      { align: 'center', width: 495 }
    );

  doc.end();
};