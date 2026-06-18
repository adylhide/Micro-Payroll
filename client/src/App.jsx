import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabaseClient';
import axios from 'axios';

const BACKEND_URL = 'http://localhost:5000/api';

const styles = {
  container: { backgroundColor: '#000', color: '#fff', minHeight: '100vh', fontFamily: '"Courier New", Courier, monospace', padding: '40px', display: 'flex', flexDirection: 'column', gap: '24px' },
  header: { borderBottom: '4px solid #fff', paddingBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' },
  statusBar: { backgroundColor: '#111', border: '1px solid #333', padding: '10px 20px', display: 'flex', gap: '40px', fontSize: '0.75rem', textTransform: 'uppercase', color: '#888' },
  statusItem: { display: 'flex', alignItems: 'center', gap: '8px' },
  indicator: { width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#0f0' },
  title: { fontSize: '3rem', fontWeight: '900', margin: 0, textTransform: 'uppercase', letterSpacing: '-2px' },
  button: { backgroundColor: '#fff', color: '#000', border: 'none', padding: '16px 32px', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer', textTransform: 'uppercase', transition: 'all 0.2s ease' },
  buttonSmall: { padding: '8px 16px', fontSize: '0.7rem' },
  buttonDanger: { backgroundColor: '#f00', color: '#fff' },
  input: { backgroundColor: '#000', color: '#fff', border: '2px solid #fff', padding: '16px', fontSize: '1rem', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' },
  card: { border: '2px solid #fff', padding: '24px', marginTop: '20px' },
  table: { width: '100%', borderCollapse: 'collapse', marginTop: '40px' },
  th: { textAlign: 'left', borderBottom: '2px solid #fff', padding: '12px', textTransform: 'uppercase', fontSize: '0.8rem' },
  td: { padding: '12px', borderBottom: '1px solid #333' },
  label: { display: 'block', marginBottom: '8px', textTransform: 'uppercase', fontSize: '0.8rem' },
  formGroup: { marginBottom: '20px' },
  calculationBox: { backgroundColor: '#111', padding: '15px', border: '1px dashed #555', marginTop: '10px', fontSize: '0.9rem' }
};

function App() {
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('employee');
  const [myPayroll, setMyPayroll] = useState(null);
  const [allPayrolls, setAllPayrolls] = useState([]);
  const [unassignedUsers, setUnassignedUsers] = useState([]);
  const [showValues, setShowValues] = useState({});
  const [form, setForm] = useState({ employee_id: '', display_id: '', name: '', gross: '', bank_account: '' });
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState('');

  // Auto-calculated values
  const grossNum = parseFloat(form.gross) || 0;
  const taxNum = (grossNum * 0.12).toFixed(2);
  const insuranceNum = (grossNum * 0.04).toFixed(2);
  const netNum = (grossNum - parseFloat(taxNum) - parseFloat(insuranceNum)).toFixed(2);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => { setSession(session); if (session) setRole(session.user?.user_metadata?.role || 'employee'); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => { setSession(s); if (s) setRole(s.user?.user_metadata?.role || 'employee'); });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    let timer;
    const resetTimer = () => {
      clearTimeout(timer);
      timer = setTimeout(async () => { await supabase.auth.signOut(); alert("SESSION EXPIRED: TERMINATING ACCESS."); window.location.reload(); }, 30000);
    };
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    events.forEach(name => window.addEventListener(name, resetTimer));
    resetTimer();
    return () => { events.forEach(name => window.removeEventListener(name, resetTimer)); clearTimeout(timer); };
  }, [session]);

  const fetchData = useCallback(async () => {
    if (!session) return;
    const cfg = { headers: { Authorization: `Bearer ${session.access_token}` } };
    try {
      if (role === 'hr') {
        const res = await axios.get(`${BACKEND_URL}/payroll/all`, cfg);
        setAllPayrolls(res.data);
        
        // Fetch unassigned rosters for automated enrollment
        const usersRes = await axios.get(`${BACKEND_URL}/payroll/unassigned-users`, cfg);
        setUnassignedUsers(usersRes.data);
      } else {
        const res = await axios.get(`${BACKEND_URL}/payroll/me`, cfg);
        setMyPayroll(res.data);
      }
    } catch (e) { console.error("DATA FETCH ERROR:", e); }
  }, [session, role]);

  useEffect(() => { if (session) fetchData(); }, [session, role, fetchData]);

  // Automated Allocation Handler
  const handleUserSelect = (e) => {
    const userId = e.target.value;
    if (!userId) {
      setForm({ ...form, employee_id: '', display_id: '' });
      return;
    }
    // Auto-generate human ID based on counter sequence
    const nextSequence = allPayrolls.length + 1;
    const autoDisplayId = `EMP-${String(nextSequence).padStart(3, '0')}`;
    
    setForm({
      ...form,
      employee_id: userId,
      display_id: autoDisplayId
    });
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) alert("ACCESS DENIED: " + error.message.toUpperCase());
  };

  const handleCreateOrUpdate = async (e) => {
    e.preventDefault();
    const payload = { ...form, tax: taxNum, insurance: insuranceNum, net: netNum };
    const cfg = { headers: { Authorization: `Bearer ${session.access_token}` } };
    try {
      if (editingId) {
        await axios.put(`${BACKEND_URL}/payroll/${editingId}`, payload, cfg);
        setMessage("RECORD UPDATED.");
      } else {
        await axios.post(`${BACKEND_URL}/payroll`, payload, cfg);
        setMessage("RECORD SECURED.");
      }
      setForm({ employee_id: '', display_id: '', name: '', gross: '', bank_account: '' });
      setEditingId(null);
      fetchData();
    } catch (err) { setMessage("ERROR: " + (err.response?.data?.error || err.message).toUpperCase()); }
  };

  const handleEdit = (p) => {
    setEditingId(p.id);
    setForm({ employee_id: p.employee_id, display_id: p.display_id, name: p.name, gross: p.gross, bank_account: p.bank_account });
  };

  const handleDelete = async (id) => {
    if (!window.confirm("PURGE THIS RECORD FROM LEDGER?")) return;
    try {
      await axios.delete(`${BACKEND_URL}/payroll/${id}`, { headers: { Authorization: `Bearer ${session.access_token}` } });
      fetchData();
    } catch (err) { alert("PURGE FAILED: " + err.message); }
  };

  if (!session) return (
    <div style={{ ...styles.container, justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ width: '100%', maxWidth: '400px', border: '4px solid #fff', padding: '40px' }}>
        <h1 style={{ ...styles.title, fontSize: '2rem', marginBottom: '30px' }}>ACCESS.SYS</h1>
        <form onSubmit={handleLogin}>
          <div style={styles.formGroup}><label style={styles.label}>Identifier</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} required style={styles.input} /></div>
          <div style={styles.formGroup}><label style={styles.label}>Credential</label><input type="password" value={password} onChange={e => setPassword(e.target.value)} required style={styles.input} /></div>
          <button type="submit" style={{ ...styles.button, width: '100%' }}>Authenticate</button>
        </form>
      </div>
    </div>
  );

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>Payroll.v1</h1>
          <p style={{ margin: '5px 0 0 0', color: '#888' }}>OPERATOR: {session.user.email} // ROLE: {role.toUpperCase()}</p>
        </div>
        <button onClick={() => supabase.auth.signOut()} style={styles.button}>Terminal.Exit</button>
      </header>

      <div style={styles.statusBar}>
        <div style={styles.statusItem}><div style={styles.indicator}></div> ENCRYPTION: AES-256-CBC</div>
        <div style={styles.statusItem}><div style={styles.indicator}></div> SESSION: SECURE</div>
        <div style={styles.statusItem}><div style={styles.indicator}></div> CALCULATOR: v2.0 READY</div>
        <div style={{ ...styles.statusItem, marginLeft: 'auto' }}>SYS_TIME: {new Date().toLocaleTimeString()}</div>
      </div>

      {role === 'hr' ? (
        <div>
          <div style={styles.card}>
            <h3 style={{ marginTop: 0 }}>{editingId ? 'MOD_RECORD' : 'NEW_ENTRY'}</h3>
            <form onSubmit={handleCreateOrUpdate} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={styles.label}>Select Unenrolled Employee (Auto-Allocates IDs)</label>
                <select 
                  onChange={handleUserSelect} 
                  disabled={!!editingId}
                  style={{ ...styles.input, backgroundColor: '#000', color: '#fff', appearance: 'none' }}
                >
                  <option value="">-- CHOOSE EMPLOYEE FROM AUTH ROSTER --</option>
                  {unassignedUsers.map(u => (
                    <option key={u.id} value={u.id}>{u.email} ({u.id.slice(0,8)}...)</option>
                  ))}
                </select>
              </div>
              <div><label style={styles.label}>Allocated Human ID</label><input type="text" value={form.display_id} readOnly style={{ ...styles.input, color: '#888', borderColor: '#333' }} placeholder="Auto-Generated" /></div>
              <div><label style={styles.label}>Allocated System Link Key</label><input type="text" value={form.employee_id} readOnly style={{ ...styles.input, color: '#888', borderColor: '#333' }} placeholder="Auto-Bound UUID" /></div>
              <div><label style={styles.label}>Full Name</label><input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required style={styles.input} /></div>
              <div><label style={styles.label}>Gross Salary ($)</label><input type="number" value={form.gross} onChange={e => setForm({ ...form, gross: e.target.value })} required style={styles.input} /></div>
              <div style={{ gridColumn: 'span 2' }}><label style={styles.label}>Bank Account</label><input type="text" value={form.bank_account} onChange={e => setForm({ ...form, bank_account: e.target.value })} required style={styles.input} /></div>
              
              <div style={{ gridColumn: 'span 2', ...styles.calculationBox }}>
                <strong>AUTOMATED LEDGER CALCULATIONS:</strong>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px' }}>
                  <span>Gross: ${grossNum.toLocaleString()}</span>
                  <span>Tax (12%): -${taxNum}</span>
                  <span>Insurance (4%): -${insuranceNum}</span>
                  <span style={{ color: '#0f0', fontWeight: 'bold' }}>NET PAY: ${netNum}</span>
                </div>
              </div>

              <div style={{ gridColumn: 'span 2', display: 'flex', gap: '10px' }}>
                <button type="submit" style={{ ...styles.button, flex: 1 }}>{editingId ? 'Update & Commit' : 'Encrypt & Save'}</button>
                {editingId && <button type="button" onClick={() => { setEditingId(null); setForm({ employee_id: '', display_id: '', name: '', gross: '', bank_account: '' }); }} style={{ ...styles.button, backgroundColor: '#333', color: '#fff' }}>Cancel</button>}
              </div>
              {message && <p style={{ gridColumn: 'span 2', marginTop: '10px', color: '#0f0' }}>{message}</p>}
            </form>
          </div>

          <table style={styles.table}>
            <thead><tr><th style={styles.th}>Emp_ID</th><th style={styles.th}>System_Link</th><th style={styles.th}>Name</th><th style={styles.th}>Gross</th><th style={styles.th}>Tax</th><th style={styles.th}>Ins.</th><th style={styles.th}>NET_PAY</th><th style={styles.th}>Actions</th></tr></thead>
            <tbody>
              {allPayrolls.map(p => (
                <tr key={p.id}>
                  <td style={styles.td}>{p.display_id}</td>
                  <td style={{ ...styles.td, color: '#555', fontSize: '0.75rem' }}>{p.employee_id.slice(0,8)}...</td>
                  <td style={styles.td}>{p.name}</td>
                  <td style={styles.td}>{showValues[p.id] ? `$${p.gross}` : 'XXXX'}</td>
                  <td style={styles.td}>{showValues[p.id] ? `-$${p.tax}` : 'XXXX'}</td>
                  <td style={styles.td}>{showValues[p.id] ? `-$${p.insurance}` : 'XXXX'}</td>
                  <td style={{ ...styles.td, fontWeight: 'bold', color: showValues[p.id] ? '#0f0' : 'inherit' }}>{showValues[p.id] ? `$${p.net}` : '$••••'}</td>
                  <td style={{ ...styles.td, display: 'flex', gap: '8px' }}>
                    <button onClick={() => setShowValues({...showValues, [p.id]: !showValues[p.id]})} style={{ ...styles.button, ...styles.buttonSmall }}>{showValues[p.id] ? 'Hide' : 'Decrypt'}</button>
                    <button onClick={() => handleEdit(p)} style={{ ...styles.button, ...styles.buttonSmall, backgroundColor: '#444', color: '#fff' }}>Edit</button>
                    <button onClick={() => handleDelete(p.id)} style={{ ...styles.button, ...styles.buttonSmall, ...styles.buttonDanger }}>Purge</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '60px' }}>
          {myPayroll ? (
            <div style={{ ...styles.card, width: '100%', maxWidth: '600px' }}>
              <h2 style={{ marginTop: 0, borderBottom: '2px solid #fff', paddingBottom: '10px' }}>MY SECURE PAYSLIP</h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', padding: '20px 0' }}>
                <p><span style={styles.label}>Name:</span> {myPayroll.name}</p>
                <p><span style={styles.label}>Gross:</span> {showValues[myPayroll.id] ? `$${myPayroll.gross}` : '$••••'}</p>
                <p><span style={styles.label}>Tax:</span> {showValues[myPayroll.id] ? `-$${myPayroll.tax}` : '$••••'}</p>
                <p><span style={styles.label}>Insurance:</span> {showValues[myPayroll.id] ? `-$${myPayroll.insurance}` : '$••••'}</p>
                <p style={{ gridColumn: 'span 2', fontSize: '1.5rem', borderTop: '1px solid #333', paddingTop: '20px' }}>
                  <span style={styles.label}>Net Amount Received:</span>
                  <span style={{ color: '#0f0', fontWeight: 'bold' }}>{showValues[myPayroll.id] ? `$${myPayroll.net}` : '$••••'}</span>
                </p>
              </div>
              <button onClick={() => setShowValues({...showValues, [myPayroll.id]: !showValues[myPayroll.id]})} style={{ ...styles.button, width: '100%' }}>{showValues[myPayroll.id] ? 'Obfuscate' : 'Decrypt Payslip'}</button>
            </div>
          ) : <div style={styles.card}><p>NO PAYROLL RECORD FOUND.</p></div>}
        </div>
      )}
    </div>
  );
}

export default App;