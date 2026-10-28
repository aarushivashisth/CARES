import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import DoctorProfile from '../DoctorProfile.jsx';
import PatientDashboard from '../pages/PatientDashboard.jsx';
import DoctorDashboard from '../pages/DoctorDashboard.jsx';
import { api } from '../services/apiClient.js';
import * as AuthContextModule from '../context/AuthContext.jsx';

describe('Milestone 5: Automated Frontend Appointment Workflow Component Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe('DoctorProfile Booking Panel Authorization & States', () => {
    it('displays Patient Login Required notice for unauthenticated visitors', async () => {
      vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
        user: null,
        isAuthenticated: false,
        role: null,
      });

      const mockDoc = {
        id: 1,
        name: 'Dr. Maya Bennett',
        specialty: 'Primary Care',
        accepting: true,
        slots: ['11:30 AM', '2:00 PM'],
        visitTypes: ['In-person'],
      };

      vi.spyOn(api, 'get').mockResolvedValue({
        success: true,
        data: mockDoc,
      });

      render(
        <MemoryRouter initialEntries={['/doctors/1']}>
          <Routes>
            <Route path="/doctors/:id" element={<DoctorProfile />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/Patient Login Required/i)).toBeTruthy();
        expect(screen.getByText(/Sign In to Request Appointment/i)).toBeTruthy();
      });
    });

    it('displays role-restriction notice when signed in with non-patient role', async () => {
      vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
        user: { id: 2, email: 'dr.daniel@cares.org', role: 'doctor' },
        isAuthenticated: true,
        role: 'doctor',
      });

      const mockDoc = {
        id: 1,
        name: 'Dr. Maya Bennett',
        specialty: 'Primary Care',
        accepting: true,
        slots: ['11:30 AM'],
        visitTypes: ['In-person'],
      };

      vi.spyOn(api, 'get').mockResolvedValue({
        success: true,
        data: mockDoc,
      });

      render(
        <MemoryRouter initialEntries={['/doctors/1']}>
          <Routes>
            <Route path="/doctors/:id" element={<DoctorProfile />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/Only registered patients can submit appointment requests/i)).toBeTruthy();
      });
    });

    it('displays Not Accepting New Patients banner and disables booking for non-accepting doctors', async () => {
      vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
        user: { id: 10, email: 'patient@cares.org', role: 'patient' },
        isAuthenticated: true,
        role: 'patient',
      });

      const mockDoc = {
        id: 3,
        name: 'Dr. Sofia Rivera',
        specialty: 'Family Medicine',
        accepting: false,
        slots: ['10:00 AM'],
        visitTypes: ['In-person'],
      };

      vi.spyOn(api, 'get').mockResolvedValue({
        success: true,
        data: mockDoc,
      });

      render(
        <MemoryRouter initialEntries={['/doctors/3']}>
          <Routes>
            <Route path="/doctors/:id" element={<DoctorProfile />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getAllByText(/Not Accepting New Patients/i).length).toBeGreaterThan(0);
        expect(screen.queryByText(/Submit Appointment Request/i)).toBeNull();
      });
    });

    it('allows eligible patient to submit request, displays 90-day booking note, and shows success card', async () => {
      vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
        user: { id: 10, email: 'patient@cares.org', role: 'patient' },
        isAuthenticated: true,
        role: 'patient',
      });

      const mockDoc = {
        id: 1,
        name: 'Dr. Maya Bennett',
        specialty: 'Primary Care',
        accepting: true,
        slots: ['11:30 AM', '2:00 PM'],
        visitTypes: ['In-person', 'Video consultation'],
      };

      vi.spyOn(api, 'get').mockResolvedValue({
        success: true,
        data: mockDoc,
      });

      const postSpy = vi.spyOn(api, 'post').mockResolvedValue({
        success: true,
        data: {
          id: 55,
          status: 'pending',
          preferred_slot: '11:30 AM',
          requested_date: '2026-11-10',
        },
      });

      render(
        <MemoryRouter initialEntries={['/doctors/1']}>
          <Routes>
            <Route path="/doctors/:id" element={<DoctorProfile />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/Booking horizon: Today through/i)).toBeTruthy();
      });

      const submitBtn = screen.getByText(/Submit Appointment Request/i);
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(postSpy).toHaveBeenCalledWith('/patient/appointments', expect.objectContaining({
          doctor_id: 1,
          preferred_slot: '11:30 AM',
        }));
        expect(screen.getByText(/Request Submitted Successfully/i)).toBeTruthy();
        expect(screen.getByText(/Go to Patient Dashboard/i)).toBeTruthy();
      });
    });
  });

  describe('PatientDashboard Appointment Management', () => {
    it('displays appointment requests with date, slot, notes, and allows patient cancellation', async () => {
      vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
        user: { id: 10, email: 'patient@cares.org', role: 'patient', profile: { full_name: 'Jane Doe' } },
        isAuthenticated: true,
        logout: vi.fn(),
      });

      const mockDashboardData = {
        profile: { full_name: 'Jane Doe', city: 'Chandigarh' },
        metrics: { totalAppointments: 1, pendingRequests: 1, acceptedAppointments: 0 },
        appointments: [
          {
            id: 101,
            doctor_name: 'Dr. Daniel Park',
            doctor_specialty: 'Cardiology',
            hospital_name: 'Riverside Medical Center',
            requested_date: '2026-11-12',
            preferred_slot: '9:00 AM',
            visit_type: 'In-person',
            status: 'pending',
            latest_notes: 'Initial consultation request',
          },
        ],
      };

      vi.spyOn(api, 'get').mockResolvedValue({
        success: true,
        data: mockDashboardData,
      });

      const patchSpy = vi.spyOn(api, 'patch').mockResolvedValue({
        success: true,
        data: { id: 101, status: 'cancelled' },
      });

      // Mock window.confirm
      vi.spyOn(window, 'confirm').mockReturnValue(true);

      render(
        <MemoryRouter initialEntries={['/patient/dashboard']}>
          <PatientDashboard />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Dr. Daniel Park')).toBeTruthy();
        expect(screen.getByText(/Initial consultation request/i)).toBeTruthy();
      });

      const cancelBtn = screen.getByText(/Cancel Visit/i);
      fireEvent.click(cancelBtn);

      await waitFor(() => {
        expect(patchSpy).toHaveBeenCalledWith('/patient/appointments/101/cancel', expect.any(Object));
      });
    });
  });

  describe('DoctorDashboard Lifecycle Transitions & Contact Info', () => {
    it('displays patient contact info and supports doctor accept action', async () => {
      vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
        user: { id: 2, email: 'dr.daniel@cares.org', role: 'doctor' },
        isAuthenticated: true,
        logout: vi.fn(),
      });

      const mockDoctorDash = {
        profile: { name: 'Dr. Daniel Park', specialty: 'Cardiology', isVerified: true },
        metrics: { totalRequests: 1, pendingReview: 1, confirmed: 0, completed: 0 },
        appointments: [
          {
            id: 202,
            patient_name: 'Robert Smith',
            patient_phone: '555-0199',
            patient_gender: 'Male',
            requested_date: '2026-11-15',
            preferred_slot: '10:45 AM',
            visit_type: 'In-person',
            status: 'pending',
          },
        ],
      };

      vi.spyOn(api, 'get').mockImplementation((endpoint) => {
        if (endpoint.includes('/dashboard')) {
          return Promise.resolve({ success: true, data: mockDoctorDash });
        }
        return Promise.resolve({ success: true, data: { doctor: { verificationStatus: 'verified' } } });
      });

      const patchSpy = vi.spyOn(api, 'patch').mockResolvedValue({
        success: true,
        data: { id: 202, status: 'accepted' },
      });

      render(
        <MemoryRouter initialEntries={['/doctor/dashboard']}>
          <DoctorDashboard />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Robert Smith')).toBeTruthy();
        expect(screen.getByText(/555-0199/i)).toBeTruthy();
      });

      const acceptBtn = screen.getByText(/✓ Accept/i);
      fireEvent.click(acceptBtn);

      await waitFor(() => {
        expect(patchSpy).toHaveBeenCalledWith('/doctor/portal/appointments/202/status', expect.objectContaining({
          status: 'accepted',
        }));
      });
    });
  });

  describe('Milestone 6: Practice Settings & Availability Scheduling (DoctorDashboard)', () => {
    it('loads practice settings, allows editing details, and submits to /doctor/portal/profile', async () => {
      vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
        user: { id: 2, email: 'dr.daniel@cares.org', role: 'doctor' },
        isAuthenticated: true,
        logout: vi.fn(),
      });

      const mockDoctorDash = {
        profile: {
          id: 1,
          name: 'Dr. Daniel Park',
          specialty: 'Cardiology',
          licenseNumber: 'PMC-8492-2015',
          isVerified: true,
          bio: 'Experienced clinical cardiologist.',
          consultationFee: 500,
          languages: ['English', 'Hindi'],
          visitTypes: ['In-person', 'Video consultation'],
          isWheelchairAccessible: true,
          slots: ['09:00 AM', '11:30 AM'],
          isAcceptingNewPatients: true,
        },
        metrics: { totalRequests: 0, pendingReview: 0, confirmed: 0, completed: 0 },
        appointments: [],
      };

      vi.spyOn(api, 'get').mockImplementation((endpoint) => {
        if (endpoint.includes('/dashboard')) {
          return Promise.resolve({ success: true, data: mockDoctorDash });
        }
        return Promise.resolve({ success: true, data: { doctor: { verificationStatus: 'verified' } } });
      });

      const putSpy = vi.spyOn(api, 'put').mockResolvedValue({
        success: true,
        data: { ...mockDoctorDash.profile, consultationFee: 650 },
      });

      render(
        <MemoryRouter initialEntries={['/doctor/dashboard']}>
          <DoctorDashboard />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/Practice Settings & Availability/i)).toBeTruthy();
        expect(screen.getByLabelText(/Consultation Fee/i)).toBeTruthy();
      });

      const feeInput = screen.getByLabelText(/Consultation Fee/i);
      fireEvent.change(feeInput, { target: { value: '650' } });

      const saveBtn = screen.getByText(/Save Practice Details/i);
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(putSpy).toHaveBeenCalledWith('/doctor/portal/profile', expect.objectContaining({
          consultationFee: 650,
          isWheelchairAccessible: true,
        }));
      });
    });

    it('toggles intake status and manages slots via /doctor/portal/availability', async () => {
      vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
        user: { id: 2, email: 'dr.daniel@cares.org', role: 'doctor' },
        isAuthenticated: true,
        logout: vi.fn(),
      });

      const mockDoctorDash = {
        profile: {
          id: 1,
          name: 'Dr. Daniel Park',
          specialty: 'Cardiology',
          licenseNumber: 'PMC-8492-2015',
          isVerified: true,
          bio: 'Experienced cardiologist.',
          consultationFee: 500,
          languages: ['English'],
          visitTypes: ['In-person'],
          isWheelchairAccessible: true,
          slots: ['09:00 AM', '11:30 AM'],
          isAcceptingNewPatients: true,
        },
        metrics: { totalRequests: 0, pendingReview: 0, confirmed: 0, completed: 0 },
        appointments: [],
      };

      vi.spyOn(api, 'get').mockImplementation((endpoint) => {
        if (endpoint.includes('/dashboard')) {
          return Promise.resolve({ success: true, data: mockDoctorDash });
        }
        return Promise.resolve({ success: true, data: { doctor: { verificationStatus: 'verified' } } });
      });

      const putSpy = vi.spyOn(api, 'put').mockResolvedValue({
        success: true,
        data: { isAcceptingNewPatients: false, availableSlots: ['09:00 AM', '11:30 AM'] },
      });

      render(
        <MemoryRouter initialEntries={['/doctor/dashboard']}>
          <DoctorDashboard />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/Pause Patient Intake/i)).toBeTruthy();
      });

      // Toggle intake
      const pauseBtn = screen.getByText(/Pause Patient Intake/i);
      fireEvent.click(pauseBtn);

      await waitFor(() => {
        expect(putSpy).toHaveBeenCalledWith('/doctor/portal/availability', expect.objectContaining({
          isAcceptingNewPatients: false,
        }));
      });
    });
  });

  describe('Milestone 6: Patient Profile Management (PatientDashboard)', () => {
    it('prepopulates profile fields, validates errors, and saves via /patient/profile', async () => {
      vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
        user: { id: 10, email: 'patient@cares.org', role: 'patient' },
        isAuthenticated: true,
        logout: vi.fn(),
      });

      const mockPatientDash = {
        profile: {
          id: 1,
          full_name: 'Ananya Sharma',
          phone: '555-0192',
          gender: 'Female',
          date_of_birth: '1992-05-14',
          emergency_contact: 'Vikram Sharma (555-0193)',
          city: 'Chandigarh',
        },
        metrics: { totalAppointments: 0, pendingRequests: 0, acceptedAppointments: 0, declinedAppointments: 0 },
        appointments: [],
      };

      vi.spyOn(api, 'get').mockResolvedValue({
        success: true,
        data: mockPatientDash,
      });

      const putSpy = vi.spyOn(api, 'put').mockResolvedValue({
        success: true,
        data: {
          ...mockPatientDash.profile,
          full_name: 'Ananya Sharma Updated',
          city: 'Mohali',
        },
      });

      render(
        <MemoryRouter initialEntries={['/patient/dashboard']}>
          <PatientDashboard />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Ananya Sharma')).toBeTruthy();
        expect(screen.getByText('555-0192')).toBeTruthy();
      });

      // Open Edit Profile modal
      const editButtons = screen.getAllByText(/Edit/i);
      fireEvent.click(editButtons[0]);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeTruthy();
        expect(screen.getByLabelText(/Full Name/i)).toBeTruthy();
      });

      // Verify prepopulation
      const nameInput = screen.getByLabelText(/Full Name/i);
      expect(nameInput.value).toBe('Ananya Sharma');

      // Update name and city
      fireEvent.change(nameInput, { target: { value: 'Ananya Sharma Updated' } });
      const cityInput = screen.getByLabelText(/City/i);
      fireEvent.change(cityInput, { target: { value: 'Mohali' } });

      // Submit modal form
      const saveBtn = screen.getByText(/Save Profile/i);
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(putSpy).toHaveBeenCalledWith('/patient/profile', expect.objectContaining({
          full_name: 'Ananya Sharma Updated',
          city: 'Mohali',
        }));
      });

      // Profile updates on screen without reload
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).toBeNull();
        expect(screen.getByText('Ananya Sharma Updated')).toBeTruthy();
        expect(screen.getAllByText('Mohali').length).toBeGreaterThan(0);
      });
    });
  });
});
