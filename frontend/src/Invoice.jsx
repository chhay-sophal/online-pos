import React, { useState } from 'react';
import { jsPDF } from 'jspdf';
import { translations as t } from './locales';

export default function Invoice({ invoiceData, locale, onClose }) {
  const { order_id, items, totalUsd, totalKhr, paymentMethod, amountPaidUsd, amountPaidKhr, changeDueKhr, timestamp } = invoiceData;

  const inv = t[locale].invoice;
  const [printing, setPrinting] = useState(false);

  const date = new Date(timestamp);
  const dateStr = date.toLocaleDateString(locale === 'km' ? 'km-KH' : 'en-US', {
    year: 'numeric', month: 'short', day: '2-digit',
  });
  const timeStr = date.toLocaleTimeString(locale === 'km' ? 'km-KH' : 'en-US', {
    hour: '2-digit', minute: '2-digit',
  });

  // Build a self-contained HTML invoice with only rgb() colors — no Tailwind, no oklch.
  const buildInvoiceHTML = () => {
    const itemRows = items.map(item => `
      <tr>
        <td class="name">${item.name}</td>
        <td class="center">${item.quantity}</td>
        <td class="right">$${(Number(item.price) * item.quantity).toFixed(2)}</td>
      </tr>`).join('');

    const cashRows = paymentMethod === 'CASH' ? `
      ${amountPaidUsd > 0 ? `<div class="row"><span class="muted">${inv.paidUsd}</span><span>$${Number(amountPaidUsd).toFixed(2)}</span></div>` : ''}
      ${amountPaidKhr > 0 ? `<div class="row"><span class="muted">${inv.paidKhr}</span><span>${Number(amountPaidKhr).toLocaleString()} ៛</span></div>` : ''}
      ${changeDueKhr > 0 ? `<div class="row change"><span>${inv.change}</span><span>${changeDueKhr.toLocaleString()} ៛</span></div>` : ''}
    ` : '';

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Invoice #${String(order_id).padStart(5, '0')}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Courier New', Courier, monospace;
      font-size: 12px;
      color: rgb(0,0,0);
      background: rgb(255,255,255);
      max-width: 480px;
      margin: 0 auto;
      padding: 24px 20px;
    }
    @page { size: A4; margin: 12mm; }
    @media print { body { padding: 0; } }
    h1 { font-size: 15px; text-align: center; margin-bottom: 3px; }
    .subtitle { text-align: center; font-size: 10px; color: rgb(100,100,100); margin-bottom: 12px; }
    .dash  { border: none; border-top: 1px dashed rgb(180,180,180); margin: 8px 0; }
    .dash2 { border: none; border-top: 2px dashed rgb(150,150,150); margin: 8px 0; }
    .row   { display: flex; justify-content: space-between; font-size: 11px; margin: 2px 0; }
    .muted { color: rgb(120,120,120); }
    table  { width: 100%; border-collapse: collapse; }
    thead th { font-size: 10px; color: rgb(120,120,120); text-transform: uppercase; padding-bottom: 5px; font-weight: bold; text-align: left; }
    td { font-size: 11px; padding: 2px 0; vertical-align: top; }
    .center { text-align: center; }
    .right  { text-align: right; }
    .name   { padding-right: 8px; }
    thead th.center { text-align: center; }
    thead th.right  { text-align: right; }
    .total  { font-size: 13px; font-weight: bold; }
    .change { font-weight: bold; color: rgb(21,128,61); }
    .footer { text-align: center; font-size: 10px; color: rgb(120,120,120); margin-top: 4px; }
  </style>
</head>
<body>
  <h1>${t[locale].shopName}</h1>
  <p class="subtitle">${inv.receiptTitle}</p>
  <hr class="dash2">

  <div class="row"><span class="muted">${inv.orderId}</span><span><strong>#${String(order_id).padStart(5, '0')}</strong></span></div>
  <div class="row"><span class="muted">${inv.date}</span><span>${dateStr}</span></div>
  <div class="row"><span class="muted">${inv.time}</span><span>${timeStr}</span></div>

  <hr class="dash">

  <table>
    <thead>
      <tr>
        <th>${inv.item}</th>
        <th class="center">${inv.qty}</th>
        <th class="right">${inv.amount}</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>

  <hr class="dash2">

  <div class="row total"><span>${inv.total}</span><span>$${totalUsd.toFixed(2)}</span></div>
  <div class="row muted"><span></span><span>${Math.round(totalKhr).toLocaleString()} ៛</span></div>

  <hr class="dash">

  <div class="row"><span class="muted">${inv.payment}</span><span><strong>${paymentMethod === 'CASH' ? inv.cash : inv.khqr}</strong></span></div>
  ${cashRows}

  <hr class="dash2">

  <p class="footer">${inv.thankYou}</p>

  <script>window.onload = function () { window.print(); }</script>
</body>
</html>`;
  };

  // jsPDF text fallback (used only when the popup is blocked).
  const downloadPDF = () => {
    const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
    const W = pdf.internal.pageSize.getWidth();
    const m = 20;
    let y = m;

    const row = (left, right, bold = false) => {
      pdf.setFont('helvetica', bold ? 'bold' : 'normal');
      pdf.text(left, m, y);
      if (right !== undefined) pdf.text(right, W - m, y, { align: 'right' });
      y += 5;
    };
    const dash = (thick = false) => {
      pdf.setLineWidth(thick ? 0.4 : 0.2);
      pdf.setDrawColor(150);
      pdf.setLineDash([1, 1]);
      pdf.line(m, y, W - m, y);
      y += 4;
    };

    pdf.setFontSize(14); row(t[locale].shopName, undefined, true);
    pdf.setFontSize(9);  row(inv.receiptTitle);
    dash(true);

    pdf.setFontSize(10);
    row(inv.orderId, `#${String(order_id).padStart(5, '0')}`);
    row(inv.date, dateStr);
    row(inv.time, timeStr);
    dash();

    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'bold');
    pdf.text(inv.item.toUpperCase(), m, y);
    pdf.text(inv.qty.toUpperCase(), W / 2, y, { align: 'center' });
    pdf.text(inv.amount.toUpperCase(), W - m, y, { align: 'right' });
    y += 4;

    pdf.setFontSize(10);
    items.forEach(item => {
      const nameLines = pdf.splitTextToSize(item.name, (W - 2 * m) * 0.62);
      pdf.setFont('helvetica', 'normal');
      pdf.text(nameLines, m, y);
      pdf.text(String(item.quantity), W / 2, y, { align: 'center' });
      pdf.text(`$${(Number(item.price) * item.quantity).toFixed(2)}`, W - m, y, { align: 'right' });
      y += nameLines.length * 4 + 1;
    });
    dash(true);

    pdf.setFontSize(12); row(inv.total, `$${totalUsd.toFixed(2)}`, true);
    pdf.setFontSize(9);
    pdf.setTextColor(100);
    pdf.text(`${Math.round(totalKhr).toLocaleString()} ៛`, W - m, y, { align: 'right' });
    pdf.setTextColor(0); y += 6;
    dash();

    pdf.setFontSize(10);
    row(inv.payment, paymentMethod === 'CASH' ? inv.cash : inv.khqr);
    if (paymentMethod === 'CASH') {
      if (amountPaidUsd > 0) row(inv.paidUsd, `$${Number(amountPaidUsd).toFixed(2)}`);
      if (amountPaidKhr > 0) row(inv.paidKhr, `${Number(amountPaidKhr).toLocaleString()} ៛`);
      if (changeDueKhr > 0) {
        pdf.setTextColor(21, 128, 61);
        row(inv.change, `${changeDueKhr.toLocaleString()} ៛`, true);
        pdf.setTextColor(0);
      }
    }
    dash(true);

    pdf.setFontSize(9);
    pdf.setTextColor(100);
    pdf.text(inv.thankYou, W / 2, y, { align: 'center' });
    pdf.setTextColor(0);

    pdf.save(`invoice-${String(order_id).padStart(5, '0')}.pdf`);
  };

  const handlePrint = () => {
    setPrinting(true);
    const html = buildInvoiceHTML();
    const printWindow = window.open('', '_blank');

    if (!printWindow || printWindow.closed) {
      // Popup blocked — download a jsPDF text invoice instead
      downloadPDF();
      setPrinting(false);
      return;
    }

    printWindow.document.write(html);
    printWindow.document.close();
    // window.onload in the HTML triggers window.print() automatically
    setPrinting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-xs mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Action bar */}
        <div className="flex gap-2 p-4 border-b border-slate-100 bg-slate-50">
          <button
            onClick={handlePrint}
            disabled={printing}
            className="flex-1 py-2.5 bg-indigo-600 text-white font-bold rounded-xl text-xs hover:bg-indigo-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {printing ? '⏳ ...' : inv.printBtn}
          </button>
          <button
            onClick={onClose}
            disabled={printing}
            className="px-4 py-2.5 bg-slate-200 text-slate-700 font-bold rounded-xl text-xs hover:bg-slate-300 transition-colors disabled:opacity-60"
          >
            {inv.closeBtn}
          </button>
        </div>

        {/* Receipt preview */}
        <div id="invoice-content" className="p-5 font-mono text-slate-900 max-h-[70vh] overflow-y-auto">
          <div className="text-center mb-4">
            <p className="text-base font-black tracking-tight">{t[locale].shopName}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">{inv.receiptTitle}</p>
          </div>

          <div className="border-t-2 border-dashed border-slate-300 mb-3" />

          <div className="text-[11px] space-y-1 mb-3">
            <div className="flex justify-between">
              <span className="text-slate-500">{inv.orderId}</span>
              <span className="font-bold">#{String(order_id).padStart(5, '0')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">{inv.date}</span>
              <span>{dateStr}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">{inv.time}</span>
              <span>{timeStr}</span>
            </div>
          </div>

          <div className="border-t border-dashed border-slate-300 mb-3" />

          <div className="flex text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">
            <span className="flex-1">{inv.item}</span>
            <span className="w-7 text-center">{inv.qty}</span>
            <span className="w-18 text-right">{inv.amount}</span>
          </div>

          <div className="space-y-1.5 mb-3">
            {items.map((item) => (
              <div key={item.id} className="flex items-start text-[11px]">
                <span className="flex-1 leading-tight pr-2 break-words">{item.name}</span>
                <span className="w-7 text-center font-bold shrink-0">{item.quantity}</span>
                <span className="w-18 text-right font-bold shrink-0">
                  ${(Number(item.price) * item.quantity).toFixed(2)}
                </span>
              </div>
            ))}
          </div>

          <div className="border-t-2 border-dashed border-slate-300 mb-3" />

          <div className="space-y-1 text-[11px] mb-3">
            <div className="flex justify-between font-black text-sm">
              <span>{inv.total}</span>
              <span>${totalUsd.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span />
              <span>{Math.round(totalKhr).toLocaleString()} ៛</span>
            </div>
          </div>

          <div className="border-t border-dashed border-slate-300 mb-3" />

          <div className="space-y-1 text-[11px] mb-3">
            <div className="flex justify-between">
              <span className="text-slate-500">{inv.payment}</span>
              <span className="font-bold">{paymentMethod === 'CASH' ? inv.cash : inv.khqr}</span>
            </div>
            {paymentMethod === 'CASH' && (
              <>
                {amountPaidUsd > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">{inv.paidUsd}</span>
                    <span>${Number(amountPaidUsd).toFixed(2)}</span>
                  </div>
                )}
                {amountPaidKhr > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">{inv.paidKhr}</span>
                    <span>{Number(amountPaidKhr).toLocaleString()} ៛</span>
                  </div>
                )}
                {changeDueKhr > 0 && (
                  <div className="flex justify-between font-bold text-emerald-700">
                    <span>{inv.change}</span>
                    <span>{changeDueKhr.toLocaleString()} ៛</span>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="border-t-2 border-dashed border-slate-300 mb-4" />

          <p className="text-center text-[11px] text-slate-500 font-semibold">{inv.thankYou}</p>
        </div>
      </div>
    </div>
  );
}
