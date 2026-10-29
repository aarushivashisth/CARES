import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/useAuth.js';
import { api } from '../services/apiClient.js';
import './Dashboard.css';

export default function DoctorDashboard() {
  const { user, logout } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);
  const [actionNotice, setActionNotice] = useState(null);

  // Accessible Appointment Action Dialog state (Decline, Cancel, Complete with Notes)
  const [actionDialog, setActionDialog] = useState(null);
  const dialogRef = useRef(null);
  const triggerRef = useRef(null);

  const [verificationData, setVerificationData] = useState(null);
  const [verificationLoading, setVerificationLoading] = useState(false);
  const [vForm, setVForm] = useState({
    licenseNumber: '',
    issuingCouncil: '',
    qualifications: '',
    affiliationRequested: '',
    evidenceTitle: '',
    evidenceIssuer: '',
  });
  const [clarificationResponseText, setClarificationResponseText] = useState('');

  // Practice Settings & Availability State
  const [practiceBio, setPracticeBio] = useState('');
  const [practiceFee, setPracticeFee] = useState(500);
  const [practiceLanguages, setPracticeLanguages] = useState(['English', 'Hindi']);
  const [practiceVisitTypes, setPracticeVisitTypes] = useState(['In-person', 'Video consultation']);
  const [practiceAccessible, setPracticeAccessible] = useState(true);
  const [practiceSaving, setPracticeSaving] = useState(false);
  const [practiceNotice, setPracticeNotice] = useState(null);

  const [intakeSaving, setIntakeSaving] = useState(false);
  const [scheduleNotice, setScheduleNotice] = useState(null);
  const [newSlotInput, setNewSlotInput] = useState('');
  const [customLangInput, setCustomLangInput] = useState('');

  const loadDoctorData = useCallback(async () => {
    try {
      setError(null);
      const [resDash, resVerif] = await Promise.all([
        api.get('/doctor/portal/dashboard'),
        api.get('/doctor/portal/verification'),
      ]);
      if (resDash.success) {
        setData(resDash.data);
        if (resDash.data?.profile) {
          const prof = resDash.data.profile;
          setPracticeBio(prof.bio || '');
          setPracticeFee(
            prof.consultationFee !== undefined && prof.consultationFee !== null
              ? prof.consultationFee
              : 500
          );
          setPracticeLanguages(
            Array.isArray(prof.languages) && prof.languages.length > 0
              ? prof.languages
              : ['English', 'Hindi']
          );
          setPracticeVisitTypes(
            Array.isArray(prof.visitTypes) && prof.visitTypes.length > 0
              ? prof.visitTypes
              : ['In-person', 'Video consultation']
          );
          setPracticeAccessible(Boolean(prof.isWheelchairAccessible));
        }
      }
      if (resVerif.success) {
        setVerificationData(resVerif.data);
        if (resVerif.data?.doctor) {
          setVForm(prev => ({
            ...prev,
            licenseNumber: resVerif.data.doctor.licenseNumber || '',
            issuingCouncil: resVerif.data.doctor.issuingCouncil || '',
            qualifications: resVerif.data.doctor.qualifications || '',
          }));
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to load physician console.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    async function init() {
      try {
        setError(null);
        const [resDash, resVerif] = await Promise.all([
          api.get('/doctor/portal/dashboard'),
          api.get('/doctor/portal/verification'),
        ]);
        if (!isMounted) return;
        if (resDash.success) {
          setData(resDash.data);
          if (resDash.data?.profile) {
            const prof = resDash.data.profile;
            setPracticeBio(prof.bio || '');
            setPracticeFee(
              prof.consultationFee !== undefined && prof.consultationFee !== null
                ? prof.consultationFee
                : 500
            );
            setPracticeLanguages(
              Array.isArray(prof.languages) && prof.languages.length > 0
                ? prof.languages
                : ['English', 'Hindi']
            );
            setPracticeVisitTypes(
              Array.isArray(prof.visitTypes) && prof.visitTypes.length > 0
                ? prof.visitTypes
                : ['In-person', 'Video consultation']
            );
            setPracticeAccessible(Boolean(prof.isWheelchairAccessible));
          }
        }
        if (resVerif.success) {
          setVerificationData(resVerif.data);
          if (resVerif.data?.doctor) {
            setVForm(prev => ({
              ...prev,
              licenseNumber: resVerif.data.doctor.licenseNumber || '',
              issuingCouncil: resVerif.data.doctor.issuingCouncil || '',
              qualifications: resVerif.data.doctor.qualifications || '',
            }));
          }
        }
      } catch (err) {
        if (isMounted) setError(err.message || 'Failed to load physician console.');
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    init();
    return () => {
      isMounted = false;
    };
  }, []);

  // Handle Intake Toggle (Pause/Reopen)
  const handleToggleIntake = async () => {
    setIntakeSaving(true);
    setScheduleNotice(null);

    const currentSlots = Array.isArray(data?.profile?.slots) ? data.profile.slots : [];
    const currentAccepting = Boolean(data?.profile?.isAcceptingNewPatients);
    const nextAccepting = !currentAccepting;

    if (nextAccepting && currentSlots.length === 0) {
      setScheduleNotice({
        type: 'error',
        message: 'Cannot enable patient intake without at least one configured appointment slot. Please add an appointment slot below first.',
      });
      setIntakeSaving(false);
      return;
    }

    try {
      const res = await api.put('/doctor/portal/availability', {
        isAcceptingNewPatients: nextAccepting,
        availableSlots: currentSlots,
      });

      if (res.success) {
        setScheduleNotice({
          type: 'success',
          message: nextAccepting
            ? 'Patient intake reopened. New patient appointments are now accepted.'
            : 'Patient intake paused. New bookings are paused while existing appointments remain intact.',
        });
        await loadDoctorData();
      } else {
        setScheduleNotice({
          type: 'error',
          message: res.error || 'Failed to update intake status.',
        });
      }
    } catch (err) {
      setScheduleNotice({
        type: 'error',
        message: err.message || 'Error updating intake status.',
      });
    } finally {
      setIntakeSaving(false);
    }
  };

  // Handle Add Slot
  const handleAddSlot = async (slotStr) => {
    const candidate = (slotStr || newSlotInput).trim();
    if (!candidate) return;

    const slotRegex = /^(0?[1-9]|1[0-2]):[0-5][0-9]\s*(AM|PM)$/i;
    if (!slotRegex.test(candidate)) {
      setScheduleNotice({
        type: 'error',
        message: "Slot format must be 'HH:MM AM' or 'HH:MM PM' (e.g., '09:30 AM', '02:00 PM').",
      });
      return;
    }

    const match = candidate.match(/^(0?[1-9]|1[0-2]):([0-5][0-9])\s*(AM|PM)$/i);
    const hour = match[1].padStart(2, '0');
    const minute = match[2];
    const meridiem = match[3].toUpperCase();
    const normalizedSlot = `${hour}:${minute} ${meridiem}`;

    const currentSlots = Array.isArray(data?.profile?.slots) ? data.profile.slots : [];
    if (currentSlots.includes(normalizedSlot)) {
      setScheduleNotice({
        type: 'error',
        message: `Slot '${normalizedSlot}' is already configured in your schedule.`,
      });
      return;
    }

    setIntakeSaving(true);
    setScheduleNotice(null);
    const updatedSlots = [...currentSlots, normalizedSlot];

    try {
      const res = await api.put('/doctor/portal/availability', {
        isAcceptingNewPatients: Boolean(data?.profile?.isAcceptingNewPatients),
        availableSlots: updatedSlots,
      });

      if (res.success) {
        setScheduleNotice({
          type: 'success',
          message: `Slot '${normalizedSlot}' added to your appointment schedule.`,
        });
        setNewSlotInput('');
        await loadDoctorData();
      } else {
        setScheduleNotice({
          type: 'error',
          message: res.error || 'Failed to add appointment slot.',
        });
      }
    } catch (err) {
      setScheduleNotice({
        type: 'error',
        message: err.message || 'Error adding appointment slot.',
      });
    } finally {
      setIntakeSaving(false);
    }
  };

  // Handle Remove Slot with Conflict Protection
  const handleRemoveSlot = async (slotToRemove) => {
    setIntakeSaving(true);
    setScheduleNotice(null);

    const currentSlots = Array.isArray(data?.profile?.slots) ? data.profile.slots : [];
    const updatedSlots = currentSlots.filter((s) => s !== slotToRemove);

    if (Boolean(data?.profile?.isAcceptingNewPatients) && updatedSlots.length === 0) {
      setScheduleNotice({
        type: 'error',
        message: 'Cannot remove the last slot while intake is active. Either pause intake first or configure another slot.',
      });
      setIntakeSaving(false);
      return;
    }

    try {
      const res = await api.put('/doctor/portal/availability', {
        isAcceptingNewPatients: Boolean(data?.profile?.isAcceptingNewPatients),
        availableSlots: updatedSlots,
      });

      if (res.success) {
        setScheduleNotice({
          type: 'success',
          message: `Slot '${slotToRemove}' was removed from your schedule.`,
        });
        await loadDoctorData();
      } else {
        setScheduleNotice({
          type: 'error',
          message: res.error || 'Failed to remove slot.',
        });
      }
    } catch (err) {
      setScheduleNotice({
        type: 'error',
        message: err.message || 'Conflict: Unable to remove slot due to existing patient bookings.',
      });
    } finally {
      setIntakeSaving(false);
    }
  };

  // Handle Practice Details Save
  const handleSavePracticeProfile = async (e) => {
    e.preventDefault();
    setPracticeSaving(true);
    setPracticeNotice(null);

    if (practiceBio.length > 1000) {
      setPracticeNotice({
        type: 'error',
        message: 'Professional biography cannot exceed 1,000 characters.',
      });
      setPracticeSaving(false);
      return;
    }

    const feeNum = parseFloat(practiceFee);
    if (isNaN(feeNum) || feeNum < 0) {
      setPracticeNotice({
        type: 'error',
        message: 'Consultation fee must be a non-negative number.',
      });
      setPracticeSaving(false);
      return;
    }

    if (practiceLanguages.length === 0) {
      setPracticeNotice({
        type: 'error',
        message: 'At least one spoken language must be selected.',
      });
      setPracticeSaving(false);
      return;
    }

    if (practiceVisitTypes.length === 0) {
      setPracticeNotice({
        type: 'error',
        message: 'At least one visit type must be selected (In-person or Video consultation).',
      });
      setPracticeSaving(false);
      return;
    }

    try {
      const res = await api.put('/doctor/portal/profile', {
        bio: practiceBio.trim(),
        consultationFee: feeNum,
        languages: practiceLanguages,
        visitTypes: practiceVisitTypes,
        isWheelchairAccessible: Boolean(practiceAccessible),
      });

      if (res.success) {
        setPracticeNotice({
          type: 'success',
          message: 'Practice profile settings saved successfully.',
        });
        await loadDoctorData();
      } else {
        setPracticeNotice({
          type: 'error',
          message: res.error || 'Failed to update practice profile.',
        });
      }
    } catch (err) {
      setPracticeNotice({
        type: 'error',
        message: err.message || 'Error updating practice profile.',
      });
    } finally {
      setPracticeSaving(false);
    }
  };

  const handleToggleLanguage = (lang) => {
    if (practiceLanguages.includes(lang)) {
      if (practiceLanguages.length > 1) {
        setPracticeLanguages(practiceLanguages.filter((l) => l !== lang));
      }
    } else {
      setPracticeLanguages([...practiceLanguages, lang]);
    }
  };

  const handleAddCustomLanguage = (e) => {
    e.preventDefault();
    const trimmed = customLangInput.trim();
    if (!trimmed) return;
    if (!practiceLanguages.includes(trimmed)) {
      setPracticeLanguages([...practiceLanguages, trimmed]);
    }
    setCustomLangInput('');
  };

  const handleToggleVisitType = (type) => {
    if (practiceVisitTypes.includes(type)) {
      if (practiceVisitTypes.length > 1) {
        setPracticeVisitTypes(practiceVisitTypes.filter((t) => t !== type));
      }
    } else {
      setPracticeVisitTypes([...practiceVisitTypes, type]);
    }
  };

  const handleVerificationSubmit = async (e) => {
    e.preventDefault();
    setVerificationLoading(true);
    setActionNotice(null);

    try {
      const payload = {
        licenseNumber: vForm.licenseNumber.trim(),
        issuingCouncil: vForm.issuingCouncil.trim(),
        qualifications: vForm.qualifications.trim(),
        affiliationRequested: vForm.affiliationRequested.trim(),
        supportingEvidence: [
          {
            type: 'professional_registration_certificate',
            title: vForm.evidenceTitle.trim() || 'State Medical Council Certificate',
            issuer: vForm.evidenceIssuer.trim() || vForm.issuingCouncil.trim(),
            verifiedMetadataOnly: true,
          }
        ]
      };

      const res = await api.post('/doctor/portal/verification/submit', payload);
      if (res.success) {
        setActionNotice({
          type: 'success',
          message: 'Verification application submitted successfully. An administrator will review your credentials.',
        });
        await loadDoctorData();
      } else {
        setActionNotice({
          type: 'error',
          message: res.error || 'Failed to submit verification application.',
        });
      }
    } catch (err) {
      setActionNotice({
        type: 'error',
        message: err.message || 'Error submitting verification.',
      });
    } finally {
      setVerificationLoading(false);
    }
  };

  const handleClarificationSubmit = async (e) => {
    e.preventDefault();
    if (!clarificationResponseText.trim()) return;
    setVerificationLoading(true);
    setActionNotice(null);

    try {
      const res = await api.post('/doctor/portal/verification/clarify', {
        clarificationResponse: clarificationResponseText.trim(),
      });
      if (res.success) {
        setActionNotice({
          type: 'success',
          message: 'Clarification submitted. Your application has returned to pending administrative review.',
        });
        setClarificationResponseText('');
        await loadDoctorData();
      } else {
        setActionNotice({
          type: 'error',
          message: res.error || 'Failed to submit clarification.',
        });
      }
    } catch (err) {
      setActionNotice({
        type: 'error',
        message: err.message || 'Error submitting clarification.',
      });
    } finally {
      setVerificationLoading(false);
    }
  };

  const todayLocal = (() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  })();

  const handleCloseDialog = useCallback(() => {
    if (actionDialog?.submitting) return;
    setActionDialog(null);
    if (triggerRef.current && typeof triggerRef.current.focus === 'function') {
      triggerRef.current.focus();
    }
  }, [actionDialog]);

  // Keyboard navigation & accessibility for Action Dialog: Escape to dismiss, initial focus, focus trap
  useEffect(() => {
    if (!actionDialog) return;

    const timer = setTimeout(() => {
      if (dialogRef.current) {
        const input = dialogRef.current.querySelector('textarea, input, button:not([aria-label="Close dialog"])');
        if (input) input.focus();
      }
    }, 20);

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleCloseDialog();
        return;
      }

      if (e.key === 'Tab' && dialogRef.current) {
        const focusables = Array.from(
          dialogRef.current.querySelectorAll(
            'input:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])'
          )
        );

        if (focusables.length === 0) {
          e.preventDefault();
          return;
        }

        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first || !dialogRef.current.contains(document.activeElement)) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last || !dialogRef.current.contains(document.activeElement)) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [actionDialog, handleCloseDialog]);

  const handleOpenDeclineDialog = (appt, e) => {
    triggerRef.current = e?.currentTarget || null;
    setActionDialog({
      appointment: appt,
      status: 'declined',
      notes: '',
      validationError: null,
      apiError: null,
      submitting: false,
    });
  };

  const handleOpenCancelDialog = (appt, e) => {
    triggerRef.current = e?.currentTarget || null;
    setActionDialog({
      appointment: appt,
      status: 'cancelled',
      notes: '',
      validationError: null,
      apiError: null,
      submitting: false,
    });
  };

  const handleOpenCompleteDialog = (appt, e) => {
    triggerRef.current = e?.currentTarget || null;
    setActionDialog({
      appointment: appt,
      status: 'completed',
      notes: 'Consultation successfully completed',
      validationError: null,
      apiError: null,
      submitting: false,
    });
  };

  const handleDialogSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!actionDialog || actionDialog.submitting) return;

    const { appointment, status, notes } = actionDialog;
    const trimmedNotes = (notes || '').trim();

    // Cancellation requires at least 5 characters
    if (status === 'cancelled') {
      if (!trimmedNotes || trimmedNotes.length < 5) {
        setActionDialog(prev => ({
          ...prev,
          validationError: 'A cancellation reason of at least 5 characters is required.',
        }));
        return;
      }
    }

    // Notes length boundary (max 500 characters)
    if (trimmedNotes.length > 500) {
      setActionDialog(prev => ({
        ...prev,
        validationError: 'Notes cannot exceed 500 characters.',
      }));
      return;
    }

    let finalNotes = trimmedNotes;
    if (status === 'declined' && !finalNotes) {
      finalNotes = 'Provider schedule unavailable';
    } else if (status === 'completed' && !finalNotes) {
      finalNotes = 'Consultation successfully completed';
    }

    setActionDialog(prev => ({ ...prev, submitting: true, validationError: null, apiError: null }));
    setUpdatingId(appointment.id);
    setActionNotice(null);

    try {
      const res = await api.patch(`/doctor/portal/appointments/${appointment.id}/status`, {
        status,
        notes: finalNotes || `Physician updated status to ${status}`,
      });

      if (res.success) {
        setActionNotice({
          type: 'success',
          message: `Appointment #${appointment.id} has been successfully ${status}.`,
        });
        setActionDialog(null);
        if (triggerRef.current && typeof triggerRef.current.focus === 'function') {
          triggerRef.current.focus();
        }
        await loadDoctorData();
      } else {
        // Retain input and display server error within dialog
        setActionDialog(prev => ({
          ...prev,
          submitting: false,
          apiError: res.error || `Failed to update appointment to ${status}.`,
        }));
      }
    } catch (err) {
      console.error('Failed to update appointment status:', err);
      // Retain input and display network/server error within dialog
      setActionDialog(prev => ({
        ...prev,
        submitting: false,
        apiError: err.message || `Unable to ${status} appointment #${appointment.id}.`,
      }));
    } finally {
      setUpdatingId(null);
    }
  };

  const handleStatusChange = async (appointmentId, newStatus, customNotes = null) => {
    // If called without customNotes for workflows requiring input, open accessible dialog
    if (customNotes === null && ['declined', 'cancelled', 'completed'].includes(newStatus)) {
      const appt = data?.appointments?.find(a => a.id === appointmentId) || { id: appointmentId };
      if (newStatus === 'declined') {
        handleOpenDeclineDialog(appt);
      } else if (newStatus === 'cancelled') {
        handleOpenCancelDialog(appt);
      } else if (newStatus === 'completed') {
        handleOpenCompleteDialog(appt);
      }
      return;
    }

    setUpdatingId(appointmentId);
    setActionNotice(null);

    try {
      const res = await api.patch(`/doctor/portal/appointments/${appointmentId}/status`, {
        status: newStatus,
        notes: customNotes || `Physician updated status to ${newStatus}`,
      });

      if (res.success) {
        setActionNotice({
          type: 'success',
          message: `Appointment #${appointmentId} has been successfully ${newStatus}.`,
        });
        await loadDoctorData();
      } else {
        setActionNotice({
          type: 'error',
          message: res.error || `Failed to update appointment to ${newStatus}.`,
        });
      }
    } catch (err) {
      console.error('Failed to update appointment status:', err);
      setActionNotice({
        type: 'error',
        message: err.message || `Unable to ${newStatus} appointment #${appointmentId}.`,
      });
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <main className="dashboard-page page-width">
      <div className="dashboard-banner">
        <span className="dashboard-banner-badge">Doctor Portal</span>
        <span>
          Live physician management console connected to CARES relational appointment registry.
        </span>
      </div>

      <header className="dashboard-header">
        <div className="dashboard-title-wrap">
          <p className="dashboard-eyebrow">PHYSICIAN CONSOLE</p>
          <h1>{data?.profile?.name || user?.email}</h1>
          <p className="dashboard-user-meta">
            {data?.profile?.specialty} · License: {data?.profile?.licenseNumber}
          </p>
        </div>
        <button type="button" onClick={logout} className="dashboard-logout-button">
          Sign out ⎋
        </button>
      </header>

      {actionNotice && (
        <div
          style={{
            padding: '12px 18px',
            marginBottom: '20px',
            borderRadius: '8px',
            background: actionNotice.type === 'success' ? '#def7ec' : '#fde8e8',
            color: actionNotice.type === 'success' ? '#03543f' : '#9b1c1c',
            border: `1px solid ${actionNotice.type === 'success' ? '#bcf0da' : '#f8b4b4'}`,
            fontSize: '13px',
            fontWeight: 600,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>{actionNotice.message}</span>
          <button
            type="button"
            onClick={() => setActionNotice(null)}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '14px', color: 'inherit' }}
          >
            ✕
          </button>
        </div>
      )}

      {loading ? (
        <p style={{ color: '#168044', padding: '24px 0' }}>Loading physician console...</p>
      ) : error ? (
        <div className="login-alert-error">Failed to load physician data: {error}</div>
      ) : (
        <>
          <section className="dashboard-metrics-grid">
            <div className="dashboard-metric-card">
              <p>Verification Status</p>
              <strong style={{ color: data?.profile?.isVerified ? '#03543f' : '#92400e', fontSize: '20px' }}>
                {data?.profile?.isVerified ? '✓ Verified Provider' : '⏳ Pending Review'}
              </strong>
            </div>
            <div className="dashboard-metric-card">
              <p>Pending Review</p>
              <strong>{data?.metrics?.pendingReview || 0}</strong>
            </div>
            <div className="dashboard-metric-card">
              <p>Confirmed Visits</p>
              <strong>{data?.metrics?.confirmed || 0}</strong>
            </div>
            <div className="dashboard-metric-card">
              <p>Completed Visits</p>
              <strong>{data?.metrics?.completed || 0}</strong>
            </div>
          </section>

          <div className="dashboard-panels-grid">
            <div>
              <article className="dashboard-panel">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h2 style={{ margin: 0, borderBottom: 'none', paddingBottom: 0 }}>Incoming Appointment Requests</h2>
                  <button
                    type="button"
                    onClick={loadDoctorData}
                    style={{
                      background: 'transparent',
                      border: '1px solid #d4ded3',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      color: '#3b5247',
                      cursor: 'pointer',
                    }}
                  >
                    ↻ Refresh
                  </button>
                </div>

                {data?.appointments && data.appointments.length > 0 ? (
                  <div className="dashboard-list">
                    {data.appointments.map((appt) => {
                      const isPending = appt.status === 'pending' || appt.status === 'requested';
                      const isAccepted = appt.status === 'accepted' || appt.status === 'confirmed';
                      const isFuture = Boolean(appt.requested_date && appt.requested_date > todayLocal);
                      const isBusy = updatingId === appt.id;

                      return (
                        <div className="dashboard-list-item" key={appt.id}>
                          <div className="dashboard-list-info" style={{ flex: '1 1 250px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                              <h3 style={{ margin: 0 }}>{appt.patient_name || `Patient #${appt.patient_id}`}</h3>
                              <span style={{ fontSize: '11px', color: '#64748b' }}>Req #{appt.id}</span>
                            </div>
                            <p>
                              <strong>Date:</strong> {appt.requested_date || 'Date not specified'} · <strong>Time:</strong> {appt.preferred_slot}
                            </p>
                            <p style={{ marginTop: '4px', color: '#68776e' }}>
                              <strong>Type:</strong> {appt.visit_type} · <strong>Reason:</strong> {appt.reason_for_visit || 'Routine Consultation'}
                            </p>
                            {appt.patient_phone && (
                              <div className="dashboard-patient-contact">
                                <span>📞 {appt.patient_phone}</span>
                                {appt.patient_gender && <span>• Gender: {appt.patient_gender}</span>}
                              </div>
                            )}
                            {appt.latest_notes && (
                              <div className="dashboard-notes-box">
                                <strong>Status Note:</strong> {appt.latest_notes}
                              </div>
                            )}
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                            <span className={`status-badge ${appt.status}`}>
                              ● {appt.status}
                            </span>

                            {isPending && (
                              <div className="dashboard-action-buttons">
                                <button
                                  type="button"
                                  className="dashboard-accept-btn"
                                  disabled={isBusy}
                                  onClick={() => handleStatusChange(appt.id, 'accepted')}
                                >
                                  {isBusy ? 'Saving...' : '✓ Accept'}
                                </button>
                                <button
                                  type="button"
                                  className="dashboard-decline-btn"
                                  disabled={isBusy}
                                  onClick={(e) => handleOpenDeclineDialog(appt, e)}
                                >
                                  {isBusy ? 'Saving...' : '✕ Decline'}
                                </button>
                              </div>
                            )}

                            {isAccepted && (
                              <div className="dashboard-action-buttons">
                                <button
                                  type="button"
                                  className="dashboard-complete-btn"
                                  disabled={isBusy || isFuture}
                                  title={isFuture ? `Can only complete visit on or after ${appt.requested_date}` : 'Mark consultation as completed'}
                                  onClick={(e) => handleOpenCompleteDialog(appt, e)}
                                >
                                  {isBusy ? 'Saving...' : '✓ Complete'}
                                </button>
                                <button
                                  type="button"
                                  className="dashboard-cancel-btn"
                                  disabled={isBusy}
                                  onClick={(e) => handleOpenCancelDialog(appt, e)}
                                >
                                  {isBusy ? 'Saving...' : 'Cancel Visit'}
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="dashboard-placeholder-card">
                    <strong>No incoming appointment requests currently pending</strong>
                    Patient consultation requests will appear here as they are submitted through the discovery directory.
                  </div>
                )}
              </article>

              {/* Milestone 6: Practice Settings & Availability Section */}
              <article className="dashboard-panel" id="practice-settings-section" style={{ marginTop: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h2 style={{ margin: 0, borderBottom: 'none', paddingBottom: 0 }}>Practice Settings & Availability</h2>
                  <span style={{ fontSize: '11px', color: '#68776e', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                    Practice Management
                  </span>
                </div>

                {/* Sub-section 1: Intake Status */}
                <div style={{ marginBottom: '24px' }}>
                  <h3 style={{ fontSize: '15px', color: '#1f2937', margin: '0 0 10px', fontWeight: 600 }}>
                    1. Patient Intake & Scheduling Status
                  </h3>

                  {scheduleNotice && (
                    <div
                      style={{
                        padding: '10px 14px',
                        marginBottom: '12px',
                        borderRadius: '6px',
                        background: scheduleNotice.type === 'success' ? '#def7ec' : '#fde8e8',
                        color: scheduleNotice.type === 'success' ? '#03543f' : '#9b1c1c',
                        border: `1px solid ${scheduleNotice.type === 'success' ? '#bcf0da' : '#f8b4b4'}`,
                        fontSize: '13px',
                        fontWeight: 500,
                      }}
                    >
                      {scheduleNotice.message}
                    </div>
                  )}

                  <div className={`settings-intake-card ${data?.profile?.isAcceptingNewPatients ? 'accepting' : 'paused'}`}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                        <span className={`intake-badge ${data?.profile?.isAcceptingNewPatients ? 'accepting' : 'paused'}`}>
                          {data?.profile?.isAcceptingNewPatients ? '● Accepting New Patients' : '⏸ Intake Paused'}
                        </span>
                        <span style={{ fontSize: '12px', color: '#4b5563', fontWeight: 500 }}>
                          {data?.profile?.isAcceptingNewPatients
                            ? 'Your profile is bookable in the discovery directory.'
                            : 'New booking requests are currently disabled.'}
                        </span>
                      </div>
                      <p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>
                        Pausing intake stops new patient appointments while keeping all existing and confirmed appointments completely intact.
                      </p>
                    </div>

                    <button
                      type="button"
                      disabled={intakeSaving}
                      onClick={handleToggleIntake}
                      className={`intake-toggle-btn ${data?.profile?.isAcceptingNewPatients ? 'pause' : 'reopen'}`}
                    >
                      {intakeSaving
                        ? 'Updating Status...'
                        : data?.profile?.isAcceptingNewPatients
                        ? 'Pause Patient Intake'
                        : 'Reopen Patient Intake'}
                    </button>
                  </div>
                </div>

                {/* Sub-section 2: Schedule Manager */}
                <div style={{ marginBottom: '28px', borderTop: '1px solid #edf1eb', paddingTop: '20px' }}>
                  <h3 style={{ fontSize: '15px', color: '#1f2937', margin: '0 0 6px', fontWeight: 600 }}>
                    2. Appointment Schedule Manager
                  </h3>
                  <p style={{ margin: '0 0 12px', fontSize: '12px', color: '#68776e' }}>
                    Configure recurring available consultation slots. Removing a slot with active upcoming bookings will be blocked to protect patient appointments.
                  </p>

                  <div className="schedule-slots-wrap">
                    {data?.profile?.slots && data.profile.slots.length > 0 ? (
                      data.profile.slots.map((slot) => (
                        <span key={slot} className="schedule-slot-chip">
                          <span>{slot}</span>
                          <button
                            type="button"
                            className="schedule-slot-remove"
                            disabled={intakeSaving}
                            title={`Remove slot ${slot}`}
                            aria-label={`Remove slot ${slot}`}
                            onClick={() => handleRemoveSlot(slot)}
                          >
                            ✕
                          </button>
                        </span>
                      ))
                    ) : (
                      <p style={{ color: '#b45309', fontSize: '13px', margin: '4px 0' }}>
                        ⚠️ No slots configured. Add appointment slots below to enable patient bookings.
                      </p>
                    )}
                  </div>

                  <div className="slot-add-bar">
                    <input
                      type="text"
                      className="slot-input"
                      placeholder="e.g. 09:30 AM or 02:00 PM"
                      value={newSlotInput}
                      onChange={(e) => setNewSlotInput(e.target.value)}
                      disabled={intakeSaving}
                    />
                    <button
                      type="button"
                      className="slot-add-btn"
                      disabled={intakeSaving || !newSlotInput.trim()}
                      onClick={() => handleAddSlot()}
                    >
                      {intakeSaving ? 'Saving...' : '+ Add Slot'}
                    </button>

                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap', marginLeft: '6px' }}>
                      <span style={{ fontSize: '11px', color: '#68776e' }}>Quick Add:</span>
                      {['09:00 AM', '10:30 AM', '11:30 AM', '02:00 PM', '03:30 PM', '05:00 PM'].map((qSlot) => (
                        <button
                          key={qSlot}
                          type="button"
                          disabled={intakeSaving || (data?.profile?.slots || []).includes(qSlot)}
                          onClick={() => handleAddSlot(qSlot)}
                          style={{
                            background: '#f3f4f6',
                            border: '1px solid #d1d5db',
                            borderRadius: '12px',
                            padding: '2px 8px',
                            fontSize: '11px',
                            cursor: (data?.profile?.slots || []).includes(qSlot) ? 'default' : 'pointer',
                            color: (data?.profile?.slots || []).includes(qSlot) ? '#9ca3af' : '#374151',
                          }}
                        >
                          +{qSlot}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Sub-section 3: Practice Details Form */}
                <div style={{ borderTop: '1px solid #edf1eb', paddingTop: '20px' }}>
                  <h3 style={{ fontSize: '15px', color: '#1f2937', margin: '0 0 6px', fontWeight: 600 }}>
                    3. Practice Details & Clinical Consultation
                  </h3>
                  <p style={{ margin: '0 0 14px', fontSize: '12px', color: '#68776e' }}>
                    Update your public practice biography, consultation fees, supported languages, visit modalities, and clinic accessibility.
                  </p>

                  {practiceNotice && (
                    <div
                      style={{
                        padding: '10px 14px',
                        marginBottom: '14px',
                        borderRadius: '6px',
                        background: practiceNotice.type === 'success' ? '#def7ec' : '#fde8e8',
                        color: practiceNotice.type === 'success' ? '#03543f' : '#9b1c1c',
                        border: `1px solid ${practiceNotice.type === 'success' ? '#bcf0da' : '#f8b4b4'}`,
                        fontSize: '13px',
                        fontWeight: 500,
                      }}
                    >
                      {practiceNotice.message}
                    </div>
                  )}

                  <form onSubmit={handleSavePracticeProfile}>
                    <div className="practice-field" style={{ marginBottom: '14px' }}>
                      <label htmlFor="practice-bio">
                        Professional Biography (Max 1,000 characters) *
                      </label>
                      <textarea
                        id="practice-bio"
                        className="practice-textarea"
                        value={practiceBio}
                        maxLength={1000}
                        onChange={(e) => setPracticeBio(e.target.value)}
                        placeholder="Describe your clinical background, specialized focus, and patient care philosophy..."
                        required
                      />
                      <div className="char-counter">
                        {practiceBio.length} / 1,000 characters
                      </div>
                    </div>

                    <div className="practice-form-grid" style={{ marginBottom: '14px' }}>
                      <div className="practice-field">
                        <label htmlFor="practice-fee">
                          Consultation Fee (₹ INR) *
                        </label>
                        <input
                          id="practice-fee"
                          type="number"
                          min="0"
                          step="10"
                          className="practice-input"
                          value={practiceFee}
                          onChange={(e) => setPracticeFee(e.target.value)}
                          required
                        />
                        <span style={{ fontSize: '11px', color: '#6b7280' }}>
                          Standard consultation charges per session
                        </span>
                      </div>

                      <div className="practice-field">
                        <label>Clinic Wheelchair Accessibility</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                          <input
                            type="checkbox"
                            id="practice-accessible"
                            checked={practiceAccessible}
                            onChange={(e) => setPracticeAccessible(e.target.checked)}
                            style={{ width: '16px', height: '16px', accentColor: '#166534' }}
                          />
                          <label htmlFor="practice-accessible" style={{ fontSize: '13px', color: '#374151', cursor: 'pointer' }}>
                            Wheelchair accessible clinic / step-free ramp access
                          </label>
                        </div>
                      </div>
                    </div>

                    <div className="practice-field" style={{ marginBottom: '14px' }}>
                      <label>Spoken Languages (Select all that apply) *</label>
                      <div className="tag-pills-wrap">
                        {['English', 'Hindi', 'Punjabi', 'Urdu', 'Spanish', 'French', 'Bengali'].map((lang) => (
                          <button
                            type="button"
                            key={lang}
                            className={`tag-pill ${practiceLanguages.includes(lang) ? 'active' : ''}`}
                            onClick={() => handleToggleLanguage(lang)}
                          >
                            {practiceLanguages.includes(lang) ? `✓ ${lang}` : `+ ${lang}`}
                          </button>
                        ))}
                      </div>

                      <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                        <input
                          type="text"
                          placeholder="Add other language..."
                          value={customLangInput}
                          onChange={(e) => setCustomLangInput(e.target.value)}
                          style={{ padding: '4px 8px', fontSize: '12px', border: '1px solid #d1d5db', borderRadius: '6px' }}
                        />
                        <button
                          type="button"
                          onClick={handleAddCustomLanguage}
                          disabled={!customLangInput.trim()}
                          style={{ padding: '4px 10px', fontSize: '12px', background: '#e5e7eb', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                        >
                          Add
                        </button>
                      </div>
                    </div>

                    <div className="practice-field" style={{ marginBottom: '20px' }}>
                      <label>Supported Visit Modalities *</label>
                      <div style={{ display: 'flex', gap: '20px', marginTop: '6px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={practiceVisitTypes.includes('In-person')}
                            onChange={() => handleToggleVisitType('In-person')}
                            style={{ width: '16px', height: '16px', accentColor: '#166534' }}
                          />
                          In-person Consultation
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={practiceVisitTypes.includes('Video consultation')}
                            onChange={() => handleToggleVisitType('Video consultation')}
                            style={{ width: '16px', height: '16px', accentColor: '#166534' }}
                          />
                          Video consultation (Telehealth)
                        </label>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={practiceSaving}
                      className="dashboard-accept-btn"
                      style={{ padding: '10px 24px', fontSize: '14px' }}
                    >
                      {practiceSaving ? 'Saving Practice Details...' : 'Save Practice Details'}
                    </button>
                  </form>
                </div>
              </article>
            </div>

            <div>
              <aside className="dashboard-panel" style={{ marginBottom: '20px' }}>
                <h2>Credential Verification & Registration</h2>
                {(() => {
                  const vStatus = verificationData?.doctor?.verificationStatus || 'not_submitted';
                  const app = verificationData?.application;

                  if (vStatus === 'verified') {
                    return (
                      <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#166534', fontWeight: 700, marginBottom: '6px' }}>
                          <span>✓ Official Credential Verification Active</span>
                        </div>
                        <p style={{ margin: '0 0 8px', fontSize: '13px', color: '#14532d' }}>
                          Your medical registration has been verified against the official medical council directory. Your profile displays the public verified badge.
                        </p>
                        <div style={{ fontSize: '12px', color: '#374151', lineHeight: '1.6' }}>
                          <div><strong>Registration #:</strong> {verificationData?.doctor?.licenseNumber}</div>
                          <div><strong>Issuing Council:</strong> {verificationData?.doctor?.issuingCouncil || 'State Medical Council'}</div>
                          <div><strong>Qualifications:</strong> {verificationData?.doctor?.qualifications || 'Medical Degree'}</div>
                          {verificationData?.doctor?.verifiedAt && (
                            <div><strong>Verified On:</strong> {verificationData?.doctor?.verifiedAt}</div>
                          )}
                        </div>
                      </div>
                    );
                  }

                  if (vStatus === 'needs_clarification') {
                    return (
                      <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '14px' }}>
                        <div style={{ color: '#b45309', fontWeight: 700, marginBottom: '6px' }}>
                          ⚠ Clarification Requested by Administrator
                        </div>
                        <p style={{ margin: '0 0 10px', fontSize: '13px', color: '#78350f', background: '#fef3c7', padding: '8px 12px', borderRadius: '6px' }}>
                          "{app?.clarification_request || 'Please provide updated registration council details.'}"
                        </p>
                        <form onSubmit={handleClarificationSubmit}>
                          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>
                            Your Clarification Response:
                          </label>
                          <textarea
                            rows={3}
                            value={clarificationResponseText}
                            onChange={(e) => setClarificationResponseText(e.target.value)}
                            placeholder="Provide requested details or registration confirmation..."
                            required
                            style={{ width: '100%', boxSizing: 'border-box', padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px', marginBottom: '8px' }}
                          />
                          <button
                            type="submit"
                            disabled={verificationLoading}
                            className="dashboard-accept-btn"
                            style={{ width: '100%', padding: '8px' }}
                          >
                            {verificationLoading ? 'Submitting...' : 'Submit Clarification Response →'}
                          </button>
                        </form>
                      </div>
                    );
                  }

                  if (vStatus === 'pending') {
                    return (
                      <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '14px' }}>
                        <div style={{ color: '#1e40af', fontWeight: 700, marginBottom: '6px' }}>
                          ⏳ Application Under Administrative Review
                        </div>
                        <p style={{ margin: '0 0 10px', fontSize: '13px', color: '#1e3a8a' }}>
                          Your credentials are submitted and undergoing primary source verification against medical council registries. You will receive an update once an administrator reviews your submission.
                        </p>
                        <div style={{ fontSize: '12px', color: '#4b5563' }}>
                          <div><strong>License #:</strong> {verificationData?.doctor?.licenseNumber}</div>
                          <div><strong>Council:</strong> {verificationData?.doctor?.issuingCouncil || 'Submitted Council'}</div>
                          <div><strong>Qualifications:</strong> {verificationData?.doctor?.qualifications}</div>
                        </div>
                      </div>
                    );
                  }

                  if (vStatus === 'suspended') {
                    return (
                      <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '14px' }}>
                        <div style={{ color: '#991b1b', fontWeight: 700, marginBottom: '6px' }}>
                          ⛔ Verification Suspended
                        </div>
                        <p style={{ margin: 0, fontSize: '13px', color: '#7f1d1d' }}>
                          Reason: {app?.decision_reason || 'Administrative policy review or lapsed council registration.'}
                        </p>
                      </div>
                    );
                  }

                  // Default: not_submitted, unverified, or rejected
                  return (
                    <div>
                      {vStatus === 'rejected' && (
                        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', padding: '10px', marginBottom: '12px', fontSize: '12px', color: '#991b1b' }}>
                          <strong>Previous Submission Rejected:</strong> {app?.decision_reason || 'Unable to confirm registration.'}
                        </div>
                      )}
                      <p style={{ margin: '0 0 12px', fontSize: '13px', color: '#4b5563' }}>
                        Submit your professional medical registration to earn the official CARES Verified badge.
                      </p>
                      <form onSubmit={handleVerificationSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#374151' }}>
                            Registration / License Number *
                          </label>
                          <input
                            type="text"
                            value={vForm.licenseNumber}
                            onChange={(e) => setVForm({ ...vForm, licenseNumber: e.target.value })}
                            placeholder="e.g. PMC-2015-8492"
                            required
                            style={{ width: '100%', boxSizing: 'border-box', padding: '6px 10px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px' }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#374151' }}>
                            Issuing Medical Council *
                          </label>
                          <input
                            type="text"
                            value={vForm.issuingCouncil}
                            onChange={(e) => setVForm({ ...vForm, issuingCouncil: e.target.value })}
                            placeholder="e.g. Punjab Medical Council (PMC) / NMC"
                            required
                            style={{ width: '100%', boxSizing: 'border-box', padding: '6px 10px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px' }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#374151' }}>
                            Degrees & Qualifications *
                          </label>
                          <input
                            type="text"
                            value={vForm.qualifications}
                            onChange={(e) => setVForm({ ...vForm, qualifications: e.target.value })}
                            placeholder="e.g. MBBS, MD (Internal Medicine)"
                            required
                            style={{ width: '100%', boxSizing: 'border-box', padding: '6px 10px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px' }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#374151' }}>
                            Affiliation Request
                          </label>
                          <input
                            type="text"
                            value={vForm.affiliationRequested}
                            onChange={(e) => setVForm({ ...vForm, affiliationRequested: e.target.value })}
                            placeholder="e.g. PGIMER Sector 12 / Fortis Mohali"
                            style={{ width: '100%', boxSizing: 'border-box', padding: '6px 10px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px' }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#374151' }}>
                            Supporting Evidence Document Title
                          </label>
                          <input
                            type="text"
                            value={vForm.evidenceTitle}
                            onChange={(e) => setVForm({ ...vForm, evidenceTitle: e.target.value })}
                            placeholder="e.g. State Medical Council Registration Certificate 2024"
                            style={{ width: '100%', boxSizing: 'border-box', padding: '6px 10px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px' }}
                          />
                        </div>
                        <button
                          type="submit"
                          disabled={verificationLoading}
                          className="dashboard-accept-btn"
                          style={{ width: '100%', marginTop: '6px', padding: '8px' }}
                        >
                          {verificationLoading ? 'Submitting Application...' : 'Submit Credentials for Verification'}
                        </button>
                      </form>
                    </div>
                  );
                })()}
              </aside>

              <aside className="dashboard-panel">
                <h2>Clinical Practice Summary</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
                  <div>
                    <span style={{ color: '#68776e', display: 'block', fontSize: '11px' }}>SPECIALTY</span>
                    <strong>{data?.profile?.specialty}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#68776e', display: 'block', fontSize: '11px' }}>INTAKE STATUS</span>
                    <strong style={{ color: data?.profile?.isAcceptingNewPatients ? '#166534' : '#92400e' }}>
                      {data?.profile?.isAcceptingNewPatients ? '● Accepting Patients' : '⏸ Intake Paused'}
                    </strong>
                  </div>
                  <div>
                    <span style={{ color: '#68776e', display: 'block', fontSize: '11px' }}>CONSULTATION FEE</span>
                    <strong>₹{data?.profile?.consultationFee !== undefined && data?.profile?.consultationFee !== null ? data.profile.consultationFee : 500}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#68776e', display: 'block', fontSize: '11px' }}>SPOKEN LANGUAGES</span>
                    <strong>{Array.isArray(data?.profile?.languages) ? data.profile.languages.join(', ') : 'English, Hindi'}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#68776e', display: 'block', fontSize: '11px' }}>VISIT TYPES</span>
                    <strong>{Array.isArray(data?.profile?.visitTypes) ? data.profile.visitTypes.join(', ') : 'In-person, Video consultation'}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#68776e', display: 'block', fontSize: '11px' }}>WHEELCHAIR ACCESS</span>
                    <strong>{data?.profile?.isWheelchairAccessible ? '✓ Accessible Ramp & Facility' : 'Standard Access'}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#68776e', display: 'block', fontSize: '11px' }}>LICENSE</span>
                    <strong>{data?.profile?.licenseNumber}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#68776e', display: 'block', fontSize: '11px' }}>ISSUING COUNCIL</span>
                    <strong>{verificationData?.doctor?.issuingCouncil || 'Not specified'}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#68776e', display: 'block', fontSize: '11px' }}>QUALIFICATIONS</span>
                    <strong>{verificationData?.doctor?.qualifications || 'MBBS / Specialist'}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#68776e', display: 'block', fontSize: '11px' }}>AFFILIATED HOSPITAL</span>
                    <strong>Riverside Medical Center</strong>
                  </div>
                </div>
              </aside>

              <div className="dashboard-placeholder-card">
                <strong>⚡ Appointment State Management</strong>
                Doctors can accept or decline pending patient appointment requests. Status updates are audited in real time and recorded in SQLite.
              </div>
            </div>
          </div>
        </>
      )}

      {/* Milestone 5 / Phase 2: Accessible Appointment Workflow Dialogs */}
      {actionDialog && (
        <div
          ref={dialogRef}
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="appointment-dialog-title"
          aria-describedby="appointment-dialog-desc"
          onClick={(e) => {
            if (e.target === e.currentTarget && !actionDialog.submitting) {
              handleCloseDialog();
            }
          }}
        >
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <div>
                <h2 id="appointment-dialog-title">
                  {actionDialog.status === 'declined' && 'Decline Appointment Request'}
                  {actionDialog.status === 'cancelled' && 'Cancel Confirmed Appointment'}
                  {actionDialog.status === 'completed' && 'Complete Consultation'}
                </h2>
                <p
                  id="appointment-dialog-desc"
                  style={{ fontSize: '13px', color: '#68776e', margin: '4px 0 0' }}
                >
                  {actionDialog.status === 'declined' && (
                    <>Decline request #{actionDialog.appointment.id} for <strong>{actionDialog.appointment.patient_name || `Patient #${actionDialog.appointment.patient_id}`}</strong>.</>
                  )}
                  {actionDialog.status === 'cancelled' && (
                    <>Cancel appointment #{actionDialog.appointment.id} for <strong>{actionDialog.appointment.patient_name || `Patient #${actionDialog.appointment.patient_id}`}</strong>.</>
                  )}
                  {actionDialog.status === 'completed' && (
                    <>Confirm completion of consultation #{actionDialog.appointment.id} for <strong>{actionDialog.appointment.patient_name || `Patient #${actionDialog.appointment.patient_id}`}</strong>.</>
                  )}
                </p>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                aria-label="Close dialog"
                disabled={actionDialog.submitting}
                onClick={handleCloseDialog}
              >
                ✕
              </button>
            </div>

            {/* Appointment Summary Box */}
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '10px 14px',
                marginBottom: '16px',
                fontSize: '13px',
                color: '#334155',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span><strong>Date:</strong> {actionDialog.appointment.requested_date || 'N/A'}</span>
                <span><strong>Slot:</strong> {actionDialog.appointment.preferred_slot || 'N/A'}</span>
              </div>
              <div>
                <span><strong>Type:</strong> {actionDialog.appointment.visit_type || 'In-person'}</span>
                {actionDialog.appointment.reason_for_visit && (
                  <span> · <strong>Reason:</strong> {actionDialog.appointment.reason_for_visit}</span>
                )}
              </div>
            </div>

            {/* Completion Notice */}
            {actionDialog.status === 'completed' && (
              <p style={{ fontSize: '13px', color: '#475569', marginBottom: '14px', lineHeight: 1.4 }}>
                Please verify that the consultation has concluded. Recording consultation notes will finalize this appointment and update the patient's care history.
              </p>
            )}

            {/* Server / API Error Notice */}
            {actionDialog.apiError && (
              <div
                role="alert"
                style={{
                  padding: '10px 14px',
                  marginBottom: '16px',
                  borderRadius: '6px',
                  background: '#fde8e8',
                  color: '#9b1c1c',
                  border: '1px solid #f8b4b4',
                  fontSize: '13px',
                }}
              >
                {actionDialog.apiError}
              </div>
            )}

            <form onSubmit={handleDialogSubmit}>
              <div className="modal-field">
                <label htmlFor="appointment-action-notes">
                  {actionDialog.status === 'declined' && 'Reason for declining (optional)'}
                  {actionDialog.status === 'cancelled' && 'Cancellation Reason *'}
                  {actionDialog.status === 'completed' && 'Consultation Notes'}
                </label>
                <textarea
                  id="appointment-action-notes"
                  rows={3}
                  className={`modal-input ${actionDialog.validationError ? 'error' : ''}`}
                  value={actionDialog.notes}
                  disabled={actionDialog.submitting}
                  placeholder={
                    actionDialog.status === 'declined'
                      ? 'e.g. Provider schedule unavailable, referral recommended...'
                      : actionDialog.status === 'cancelled'
                      ? 'Provide a clear reason for cancellation (minimum 5 characters)...'
                      : 'Enter clinical consultation summary, observations, or follow-up instructions...'
                  }
                  onChange={(e) => {
                    setActionDialog(prev => ({
                      ...prev,
                      notes: e.target.value,
                      validationError: null,
                    }));
                  }}
                />
                {actionDialog.validationError && (
                  <span className="field-error-text" role="alert">
                    {actionDialog.validationError}
                  </span>
                )}
                <span className="field-help-text" style={{ fontSize: '11px', color: '#64748b' }}>
                  {actionDialog.status === 'declined' && 'Will default to "Provider schedule unavailable" if left empty.'}
                  {actionDialog.status === 'cancelled' && 'Required: Minimum 5 characters, maximum 500 characters.'}
                  {actionDialog.status === 'completed' && 'Will be recorded into the appointment history (max 500 characters).'}
                </span>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  disabled={actionDialog.submitting}
                  onClick={handleCloseDialog}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="primary-button"
                  disabled={actionDialog.submitting}
                  style={{
                    background:
                      actionDialog.status === 'declined'
                        ? '#dc2626'
                        : actionDialog.status === 'cancelled'
                        ? '#b91c1c'
                        : '#15803d',
                    borderColor:
                      actionDialog.status === 'declined'
                        ? '#b91c1c'
                        : actionDialog.status === 'cancelled'
                        ? '#991b1b'
                        : '#166534',
                  }}
                >
                  {actionDialog.submitting
                    ? 'Processing...'
                    : actionDialog.status === 'declined'
                    ? 'Decline Request'
                    : actionDialog.status === 'cancelled'
                    ? 'Confirm Cancellation'
                    : 'Complete Consultation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
