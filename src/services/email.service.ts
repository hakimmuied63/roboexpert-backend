import { Resend } from 'resend';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM || 'RoboExpert <onboarding@resend.dev>';
const EMAIL_REPLY_TO = process.env.EMAIL_REPLY_TO || undefined;

console.log('[email] RESEND_API_KEY loaded:', RESEND_API_KEY ? `YES (prefix: ${RESEND_API_KEY.slice(0, 8)})` : 'NO');

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

type SendResult = { ok: boolean; id?: string; error?: string };

async function sendEmail(params: {
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
}): Promise<SendResult> {
  
  if (!resend) {
    console.warn('[email] Skipped — Resend not configured');
    return { ok: false, error: 'Resend not configured' };
  }

  try {
    const result = await resend.emails.send({
      from: EMAIL_FROM,
      to: params.to,
      subject: params.subject,
      html: params.html,
      replyTo: params.replyTo || EMAIL_REPLY_TO,
    });

    if (result.error) {
      console.error('[email] Send failed:', result.error.message);
      return { ok: false, error: result.error.message };
    }

    return { ok: true, id: result.data?.id };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown email error';
    console.error('[email] Exception:', msg);
    return { ok: false, error: msg };
  }
}

// ---------- Template helpers ----------

function money(n: number): string {
  return `₹${n.toLocaleString('en-IN')}`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

type OrderEmailData = {
  orderNumber: string;
  buyerName: string;
  buyerEmail: string;
  sellerName: string;
  sellerEmail: string;
  items: Array<{ name: string; quantity: number; unitPrice: number }>;
  total: number;
  paymentMethod: string;
  paymentStatus: string;
  shippingAddress: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    pincode: string;
    country: string;
  };
  trackUrl: string;
  cancelUrl: string;
};

function orderSummaryHtml(order: OrderEmailData): string {
  const itemRows = order.items
    .map(
      (i) => `
      <tr>
        <td style="padding:8px 0;border-bottom:1px solid #eee;">${escapeHtml(i.name)}</td>
        <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:center;">${i.quantity}</td>
        <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right;">${money(i.unitPrice)}</td>
      </tr>`
    )
    .join('');

  const addr = order.shippingAddress;
  const addrLine2 = addr.line2 ? `<br/>${escapeHtml(addr.line2)}` : '';

  return `
    <table style="width:100%;border-collapse:collapse;font-size:14px;">
      <thead>
        <tr>
          <th style="text-align:left;padding:8px 0;border-bottom:2px solid #333;">Item</th>
          <th style="padding:8px 0;border-bottom:2px solid #333;">Qty</th>
          <th style="text-align:right;padding:8px 0;border-bottom:2px solid #333;">Price</th>
        </tr>
      </thead>
      <tbody>${itemRows}</tbody>
      <tfoot>
        <tr>
          <td colspan="2" style="padding:12px 0;text-align:right;font-weight:600;">Total</td>
          <td style="padding:12px 0;text-align:right;font-weight:700;">${money(order.total)}</td>
        </tr>
      </tfoot>
    </table>
    <div style="margin-top:16px;padding:16px;background:#f9fafb;border-radius:8px;font-size:13px;color:#374151;">
      <strong>Shipping to:</strong><br/>
      ${escapeHtml(order.buyerName)}<br/>
      ${escapeHtml(addr.line1)}${addrLine2}<br/>
      ${escapeHtml(addr.city)}, ${escapeHtml(addr.state)} - ${escapeHtml(addr.pincode)}<br/>
      ${escapeHtml(addr.country)}
    </div>
    <div style="margin-top:16px;font-size:13px;color:#6b7280;">
      Payment: <strong>${escapeHtml(order.paymentMethod.toUpperCase())}</strong>
      &nbsp;·&nbsp;
      Status: <strong>${escapeHtml(order.paymentStatus)}</strong>
    </div>
  `;
}

// ---------- Public send functions ----------

export const sendOrderConfirmationToBuyer = async (order: OrderEmailData): Promise<SendResult> => {
  const html = `
    <div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto;color:#111827;">
      <h1 style="font-size:22px;">Thanks for your order, ${escapeHtml(order.buyerName)}!</h1>
      <p style="color:#4b5563;">Your order <strong>#${escapeHtml(order.orderNumber)}</strong> has been placed successfully.</p>
      ${orderSummaryHtml(order)}
          <p style="margin-top:24px;">
        <a href="${order.trackUrl}" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;margin-right:8px;">
          Track your order
        </a>
        <a href="${order.cancelUrl}" style="display:inline-block;background:#fff;color:#dc2626;border:1px solid #dc2626;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;">
          Cancel order
        </a>
      </p>
      <p style="margin-top:24px;color:#6b7280;font-size:12px;">
        You're receiving this because you placed an order on Roboexpert.
      </p>
    </div>
  `;

  return sendEmail({
    to: order.buyerEmail,
    subject: `Order Confirmed — #${order.orderNumber}`,
    html,
    replyTo: order.sellerEmail,
  });
};

export const sendNewOrderToSeller = async (order: OrderEmailData): Promise<SendResult> => {
  const html = `
    <div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto;color:#111827;">
      <h1 style="font-size:22px;">New order received!</h1>
      <p style="color:#4b5563;">You have a new order <strong>#${escapeHtml(order.orderNumber)}</strong> from ${escapeHtml(order.buyerName)}.</p>
      ${orderSummaryHtml(order)}
      <p style="margin-top:24px;color:#6b7280;font-size:12px;">
        Log in to your seller dashboard to process this order.
      </p>
    </div>
  `;

  return sendEmail({
    to: order.sellerEmail,
    subject: `New Order — #${order.orderNumber}`,
    html,
    replyTo: order.buyerEmail,
  });
};

export const sendOrderShippedToBuyer = async (
  order: OrderEmailData,
  trackingInfo?: { carrier?: string; trackingNumber?: string }
): Promise<SendResult> => {
  const trackingBlock = trackingInfo?.trackingNumber
    ? `<p style="margin-top:16px;padding:12px;background:#f9fafb;border-radius:8px;font-size:14px;">
        <strong>Tracking:</strong> ${escapeHtml(trackingInfo.carrier || 'Carrier')} — ${escapeHtml(trackingInfo.trackingNumber)}
      </p>`
    : '';

  const html = `
    <div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto;color:#111827;">
      <h1 style="font-size:22px;">Your order is on the way!</h1>
      <p style="color:#4b5563;">Order <strong>#${escapeHtml(order.orderNumber)}</strong> has been shipped.</p>
      ${trackingBlock}
      ${orderSummaryHtml(order)}
      <p style="margin-top:24px;">
        <a href="${order.trackUrl}" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;">
          Track your order
        </a>
      </p>
    </div>
  `;

  return sendEmail({
    to: order.buyerEmail,
    subject: `Order Shipped — #${order.orderNumber}`,
    html,
    replyTo: order.sellerEmail,
  });
};

export const sendOrderDeliveredToBuyer = async (order: OrderEmailData): Promise<SendResult> => {
  const html = `
    <div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto;color:#111827;">
      <h1 style="font-size:22px;">Your order has been delivered</h1>
      <p style="color:#4b5563;">Order <strong>#${escapeHtml(order.orderNumber)}</strong> has been delivered. We hope you love it!</p>
      ${orderSummaryHtml(order)}
      <p style="margin-top:24px;color:#6b7280;font-size:12px;">
        Have an issue? You can request a return from your order page.
      </p>
    </div>
  `;

  return sendEmail({
    to: order.buyerEmail,
    subject: `Order Delivered — #${order.orderNumber}`,
    html,
    replyTo: order.sellerEmail,
  });
};

export const sendOrderCancelledToBuyer = async (
  order: OrderEmailData,
  reason?: string
): Promise<SendResult> => {
  const html = `
    <div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto;color:#111827;">
      <h1 style="font-size:22px;">Your order has been cancelled</h1>
      <p style="color:#4b5563;">Order <strong>#${escapeHtml(order.orderNumber)}</strong> was cancelled.</p>
      ${reason ? `<p style="color:#6b7280;">Reason: ${escapeHtml(reason)}</p>` : ''}
      ${orderSummaryHtml(order)}
      <p style="margin-top:24px;color:#6b7280;font-size:12px;">
        If you paid online, a refund will be processed within 5-7 business days.
      </p>
    </div>
  `;

  return sendEmail({
    to: order.buyerEmail,
    subject: `Order Cancelled — #${order.orderNumber}`,
    html,
    replyTo: order.sellerEmail,
  });
};

export const sendOrderCancelledToSeller = async (
  order: OrderEmailData,
  reason?: string
): Promise<SendResult> => {
  const html = `
    <div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto;color:#111827;">
      <h1 style="font-size:22px;">Order cancelled</h1>
      <p style="color:#4b5563;">Order <strong>#${escapeHtml(order.orderNumber)}</strong> was cancelled by the buyer.</p>
      ${reason ? `<p style="color:#6b7280;">Reason: ${escapeHtml(reason)}</p>` : ''}
      ${orderSummaryHtml(order)}
    </div>
  `;

  return sendEmail({
    to: order.sellerEmail,
    subject: `Order Cancelled — #${order.orderNumber}`,
    html,
    replyTo: order.buyerEmail,
  });
};

export const sendReturnRequestedToSeller = async (
  order: OrderEmailData,
  returnReason: string
): Promise<SendResult> => {
  const html = `
    <div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto;color:#111827;">
      <h1 style="font-size:22px;">Return requested</h1>
      <p style="color:#4b5563;">Buyer <strong>${escapeHtml(order.buyerName)}</strong> requested a return for order <strong>#${escapeHtml(order.orderNumber)}</strong>.</p>
      <p style="padding:12px;background:#fef3c7;border-radius:8px;"><strong>Reason:</strong> ${escapeHtml(returnReason)}</p>
      ${orderSummaryHtml(order)}
      <p style="margin-top:24px;color:#6b7280;font-size:12px;">
        Log in to your seller dashboard to approve or reject this return.
      </p>
    </div>
  `;

  return sendEmail({
    to: order.sellerEmail,
    subject: `Return Requested — #${order.orderNumber}`,
    html,
    replyTo: order.buyerEmail,
  });
};

export const sendReturnDecisionToBuyer = async (
  order: OrderEmailData,
  decision: 'approved' | 'rejected',
  note?: string
): Promise<SendResult> => {
  const approved = decision === 'approved';
  const html = `
    <div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto;color:#111827;">
      <h1 style="font-size:22px;">Return ${approved ? 'approved' : 'rejected'}</h1>
      <p style="color:#4b5563;">Your return request for order <strong>#${escapeHtml(order.orderNumber)}</strong> has been <strong>${decision}</strong>.</p>
      ${note ? `<p style="padding:12px;background:#f9fafb;border-radius:8px;color:#374151;"><strong>Note from seller:</strong> ${escapeHtml(note)}</p>` : ''}
      ${approved ? `<p style="margin-top:16px;color:#374151;">Refund will be processed within 5-7 business days.</p>` : ''}
    </div>
  `;

  return sendEmail({
    to: order.buyerEmail,
    subject: `Return ${approved ? 'Approved' : 'Rejected'} — #${order.orderNumber}`,
    html,
    replyTo: order.sellerEmail,
  });
};
// ---------- Admin: New Seller Signup Notification ----------

export const sendNewSellerAlertToAdmin = async (seller: {
    name: string;
    email: string;
    phone?: string;
    companyName?: string;
  }): Promise<SendResult> => {
    const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL;
  
    if (!adminEmail) {
      console.warn('[email] ADMIN_NOTIFICATION_EMAIL not set — skipping admin alert');
      return { ok: false, error: 'Admin email not configured' };
    }
  
    const html = `
      <div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto;color:#111827;">
        <h1 style="font-size:22px;">New seller awaiting approval</h1>
        <p style="color:#4b5563;">A new seller has signed up on RoboExpert and needs your review.</p>
        <table style="width:100%;margin-top:16px;font-size:14px;border-collapse:collapse;">
          <tr>
            <td style="padding:8px 0;color:#6b7280;">Name:</td>
            <td style="padding:8px 0;font-weight:600;">${escapeHtml(seller.name)}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#6b7280;">Email:</td>
            <td style="padding:8px 0;">${escapeHtml(seller.email)}</td>
          </tr>
          ${
            seller.phone
              ? `<tr>
                  <td style="padding:8px 0;color:#6b7280;">Phone:</td>
                  <td style="padding:8px 0;">${escapeHtml(seller.phone)}</td>
                </tr>`
              : ''
          }
          ${
            seller.companyName
              ? `<tr>
                  <td style="padding:8px 0;color:#6b7280;">Business:</td>
                  <td style="padding:8px 0;">${escapeHtml(seller.companyName)}</td>
                </tr>`
              : ''
          }
        </table>
        <p style="margin-top:24px;">
          <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/admin/sellers" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;">
            Review in Admin Panel
          </a>
        </p>
        <p style="margin-top:24px;color:#6b7280;font-size:12px;">
          You're receiving this because you're an admin on RoboExpert.
        </p>
      </div>
    `;
  
    return sendEmail({
      to: adminEmail,
      subject: `New seller signup: ${seller.name}`,
      html,
    });
  };
  // ---------- Seller: Approval / Rejection / Suspension Notifications ----------

export const sendSellerApprovedEmail = async (seller: {
    name: string;
    email: string;
    companyName?: string;
  }): Promise<SendResult> => {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  
    const html = `
      <div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto;color:#111827;">
        <h1 style="font-size:22px;">🎉 You're approved!</h1>
        <p style="color:#4b5563;">
          Hi ${escapeHtml(seller.name)}, your seller account${seller.companyName ? ` for <strong>${escapeHtml(seller.companyName)}</strong>` : ''} has been approved.
        </p>
        <p style="color:#4b5563;">
          You can now start listing products and selling on RoboExpert. Your storefront is live.
        </p>
        <p style="margin-top:24px;">
          <a href="${frontendUrl}/seller" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;">
            Go to Seller Dashboard
          </a>
        </p>
        <p style="margin-top:24px;color:#6b7280;font-size:12px;">
          Thanks for joining RoboExpert.
        </p>
      </div>
    `;
  
    return sendEmail({
      to: seller.email,
      subject: `You're approved — start selling on RoboExpert`,
      html,
    });
  };
  
  export const sendSellerRejectedEmail = async (seller: {
    name: string;
    email: string;
    reason: string;
  }): Promise<SendResult> => {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  
    const html = `
      <div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto;color:#111827;">
        <h1 style="font-size:22px;">Seller application needs attention</h1>
        <p style="color:#4b5563;">Hi ${escapeHtml(seller.name)},</p>
        <p style="color:#4b5563;">
          Unfortunately, your seller application could not be approved at this time.
        </p>
        <div style="margin-top:16px;padding:16px;background:#fef2f2;border-left:4px solid #dc2626;border-radius:8px;">
          <p style="margin:0;font-size:13px;color:#7f1d1d;"><strong>Reason:</strong></p>
          <p style="margin:4px 0 0 0;font-size:14px;color:#991b1b;">${escapeHtml(seller.reason)}</p>
        </div>
        <p style="color:#4b5563;margin-top:16px;">
          If you believe this is a mistake or want to re-apply with the changes, please contact support.
        </p>
        <p style="margin-top:24px;">
          <a href="${frontendUrl}" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;">
            Back to RoboExpert
          </a>
        </p>
      </div>
    `;
  
    return sendEmail({
      to: seller.email,
      subject: `RoboExpert seller application update`,
      html,
    });
  };
  
  export const sendSellerSuspendedEmail = async (seller: {
    name: string;
    email: string;
    reason: string;
  }): Promise<SendResult> => {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  
    const html = `
      <div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto;color:#111827;">
        <h1 style="font-size:22px;">Account suspended</h1>
        <p style="color:#4b5563;">Hi ${escapeHtml(seller.name)},</p>
        <p style="color:#4b5563;">
          Your RoboExpert seller account has been suspended.
        </p>
        <div style="margin-top:16px;padding:16px;background:#fef2f2;border-left:4px solid #dc2626;border-radius:8px;">
          <p style="margin:0;font-size:13px;color:#7f1d1d;"><strong>Reason:</strong></p>
          <p style="margin:4px 0 0 0;font-size:14px;color:#991b1b;">${escapeHtml(seller.reason)}</p>
        </div>
        <p style="color:#4b5563;margin-top:16px;">
          To appeal this decision, please contact our support team.
        </p>
      </div>
    `;
  
    return sendEmail({
      to: seller.email,
      subject: `RoboExpert account suspended`,
      html,
    });
  };