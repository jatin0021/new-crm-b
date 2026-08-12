import { query, checkPgStatus, inMemoryStore } from '../config/db.js';

export const listLeads = async (req, res) => {
  try {
    let leads = [];
    if (checkPgStatus()) {
      const result = await query(`SELECT * FROM leads ORDER BY id DESC`);
      leads = result.rows;
    } else {
      leads = inMemoryStore.leads;
    }
    return res.json({ message: 'Leads list fetched successfully', data: { leads } });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch leads', error: err.message });
  }
};

export const createLead = async (req, res) => {
  const { first_name, last_name, email, phone, country } = req.body;
  if (!email || !first_name) {
    return res.status(400).json({ message: 'Email and first name are required' });
  }

  try {
    let newLead = null;
    if (checkPgStatus()) {
      const result = await query(
        `INSERT INTO leads (first_name, last_name, email, phone, country) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [first_name, last_name, email, phone, country]
      );
      newLead = result.rows[0];
    } else {
      newLead = {
        id: inMemoryStore.leads.length + 1,
        first_name,
        last_name,
        email,
        phone,
        country,
        status: 'new',
        created_at: new Date().toISOString()
      };
      inMemoryStore.leads.push(newLead);
    }
    return res.status(201).json({ message: 'Lead added successfully', data: { lead: newLead } });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to create lead', error: err.message });
  }
};
