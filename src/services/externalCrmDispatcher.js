import { query, checkPgStatus, inMemoryStore } from '../config/db.js';

/**
 * Service to Dispatch Outward Webhooks to Registered External CRMs
 */
export const dispatchExternalWebhook = async (eventName, payload) => {
  try {
    let subscribers = [];

    if (checkPgStatus()) {
      const res = await query(`SELECT * FROM external_webhooks WHERE is_active = TRUE`);
      subscribers = res.rows.filter(w => {
        const eventsArr = typeof w.events === 'string' ? JSON.parse(w.events) : w.events;
        return eventsArr.includes(eventName) || eventsArr.includes('*');
      });
    } else {
      subscribers = inMemoryStore.external_webhooks.filter(w => 
        w.is_active && (w.events.includes(eventName) || w.events.includes('*'))
      );
    }

    if (subscribers.length === 0) return;

    console.log(`📤 Dispatching event '${eventName}' to ${subscribers.length} external CRM webhook subscribers...`);

    for (const sub of subscribers) {
      try {
        fetch(sub.target_url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CRM-Event': eventName,
            'X-CRM-Signature': sub.secret_signature || ''
          },
          body: JSON.stringify({
            event: eventName,
            timestamp: new Date().toISOString(),
            payload
          })
        }).catch(err => console.warn(`Failed to dispatch webhook to ${sub.target_url}: ${err.message}`));
      } catch (e) {
        // Ignore fetch errors
      }
    }
  } catch (err) {
    console.error('Error dispatching external webhooks:', err.message);
  }
};
