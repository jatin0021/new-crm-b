import { query, checkPgStatus, inMemoryStore } from '../config/db.js';

export const listSupportTickets = async (req, res) => {
  const userId = req.user.id;
  try {
    let tickets = [];
    if (checkPgStatus()) {
      const resVal = await query(`SELECT * FROM support_tickets WHERE user_id = $1 ORDER BY id DESC`, [userId]);
      tickets = resVal.rows;
    } else {
      tickets = [
        { id: 1, ticket_number: 'TKT-9018', subject: 'MT5 Leverage Update Request', category: 'trading', status: 'open', created_at: new Date().toISOString() }
      ];
    }
    return res.json({ message: 'Support tickets fetched', data: { tickets } });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch support tickets', error: err.message });
  }
};

export const createSupportTicket = async (req, res) => {
  const userId = req.user.id;
  const { subject, category, message } = req.body;

  if (!subject) {
    return res.status(400).json({ message: 'Ticket subject is required' });
  }

  const ticketNum = `TKT-${Math.floor(1000 + Math.random() * 9000)}`;

  try {
    let ticket = null;
    if (checkPgStatus()) {
      const resVal = await query(
        `INSERT INTO support_tickets (user_id, ticket_number, subject, category, status) VALUES ($1, $2, $3, $4, 'open') RETURNING *`,
        [userId, ticketNum, subject, category || 'general']
      );
      ticket = resVal.rows[0];
    } else {
      ticket = { id: Date.now(), user_id: userId, ticket_number: ticketNum, subject, category: category || 'general', status: 'open', created_at: new Date().toISOString() };
    }
    return res.status(201).json({ message: 'Support ticket created successfully', data: { ticket } });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to create support ticket', error: err.message });
  }
};
