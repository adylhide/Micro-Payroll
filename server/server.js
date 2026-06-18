const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());

const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const algorithm = 'aes-256-cbc';
const getEncryptionKey = () => crypto.scryptSync(process.env.ENCRYPTION_SECRET, 'salt', 32);

function encrypt(text) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, getEncryptionKey(), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
}

function decrypt(text) {
  try {
    const parts = text.split(':');
    const iv = Buffer.from(parts.shift(), 'hex');
    const encryptedText = Buffer.from(parts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv(algorithm, getEncryptionKey(), iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    return "[Decryption Error]";
  }
}

async function checkAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'Missing token' });
  const token = authHeader.split(' ')[1];
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return res.status(401).json({ error: 'Unauthorized' });
  req.user = user;
  next();
}

app.get('/api/payroll/me', checkAuth, async (req, res) => {
  const { data, error } = await supabaseAdmin.from('payroll').select('*').eq('employee_id', req.user.id).maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ message: 'No record found' });
  res.json({ 
    id: data.id, 
    display_id: data.display_id || 'N/A',
    name: data.name, 
    gross: decrypt(data.encrypted_salary), 
    tax: decrypt(data.encrypted_tax || ''),
    insurance: decrypt(data.encrypted_insurance || ''),
    net: decrypt(data.encrypted_net_pay || ''),
    bank_account: decrypt(data.encrypted_bank_account) 
  });
});

app.get('/api/payroll/all', checkAuth, async (req, res) => {
  if (req.user.user_metadata?.role !== 'hr') return res.status(403).json({ error: 'Forbidden' });
  const { data, error } = await supabaseAdmin.from('payroll').select('*');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data.map(item => ({ 
    id: item.id, 
    employee_id: item.employee_id, 
    display_id: item.display_id || 'N/A',
    name: item.name, 
    gross: decrypt(item.encrypted_salary),
    tax: decrypt(item.encrypted_tax || ''),
    insurance: decrypt(item.encrypted_insurance || ''),
    net: decrypt(item.encrypted_net_pay || ''),
    bank_account: decrypt(item.encrypted_bank_account) 
  })));
});

// New Endpoint: Fetch users from Supabase Auth that can be enrolled
app.get('/api/payroll/unassigned-users', checkAuth, async (req, res) => {
  if (req.user.user_metadata?.role !== 'hr') return res.status(403).json({ error: 'Forbidden' });
  
  try {
    // 1. Fetch all users from Supabase Auth management directory
    const { data: { users }, error: authError } = await supabaseAdmin.auth.admin.listUsers();
    if (authError) return res.status(500).json({ error: authError.message });

    // 2. Fetch already enrolled employee IDs from the ledger
    const { data: enrolled, error: dbError } = await supabaseAdmin.from('payroll').select('employee_id');
    if (dbError) return res.status(500).json({ error: dbError.message });

    const enrolledIds = enrolled.map(e => e.employee_id);

    // 3. Filter out users who are already enrolled or who are administrators themselves
    const unassigned = users
      .filter(u => !enrolledIds.includes(u.id) && u.user_metadata?.role !== 'hr')
      .map(u => ({ id: u.id, email: u.email }));

    res.json(unassigned);
  } catch (err) {
    res.status(500).json({ error: 'Failed to access authentication roster' });
  }
});

app.post('/api/payroll', checkAuth, async (req, res) => {
  console.log("INCOMING_COMMIT:", req.body);
  if (req.user.user_metadata?.role !== 'hr') return res.status(403).json({ error: 'Forbidden' });

  const { employee_id, display_id, name, gross, tax, insurance, net, bank_account } = req.body;
  
  if (!employee_id || !display_id || !name || !gross || !bank_account) {
    return res.status(400).json({ error: 'Missing Required Fields' });
  }

  // Restore strict UUID validation for the system link
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(employee_id)) {
    return res.status(400).json({ error: 'Invalid System Link Key (UUID required)' });
  }

  try {
    const { error } = await supabaseAdmin.from('payroll').upsert({ 
      employee_id, 
      display_id,
      name, 
      encrypted_salary: encrypt(gross.toString()), 
      encrypted_tax: encrypt(tax.toString() || '0'),
      encrypted_insurance: encrypt(insurance.toString() || '0'),
      encrypted_net_pay: encrypt(net.toString() || '0'),
      encrypted_bank_account: encrypt(bank_account) 
    }, { onConflict: 'employee_id' });
    
    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json({ message: 'Secure payroll saved.' });
  } catch (err) {
    res.status(500).json({ error: 'Internal Cryptographic Error' });
  }
});

app.put('/api/payroll/:id', checkAuth, async (req, res) => {
  if (req.user.user_metadata?.role !== 'hr') return res.status(403).json({ error: 'Forbidden' });
  const { display_id, name, gross, tax, insurance, net, bank_account } = req.body;
  const { id } = req.params;

  const { error } = await supabaseAdmin.from('payroll').update({ 
    display_id,
    name, 
    encrypted_salary: encrypt(gross.toString()), 
    encrypted_tax: encrypt(tax.toString() || '0'),
    encrypted_insurance: encrypt(insurance.toString() || '0'),
    encrypted_net_pay: encrypt(net.toString() || '0'),
    encrypted_bank_account: encrypt(bank_account) 
  }).eq('id', id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ message: 'Record updated.' });
});

app.delete('/api/payroll/:id', checkAuth, async (req, res) => {
  if (req.user.user_metadata?.role !== 'hr') return res.status(403).json({ error: 'Forbidden' });
  const { id } = req.params;

  const { error } = await supabaseAdmin.from('payroll').delete().eq('id', id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ message: 'Record purged from ledger.' });
});

if (require.main === module) {
  app.listen(5000, () => console.log('Secure server on port 5000'));
}

module.exports = { app, encrypt, decrypt, getEncryptionKey };