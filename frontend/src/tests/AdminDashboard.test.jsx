import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AdminDashboard from '../pages/AdminDashboard.jsx';
import { api } from '../services/apiClient.js';
import * as AuthContextModule from '../context/useAuth.js';

describe('Milestone 7: Automated AdminDashboard Component Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  const mockAdminData = {
    metrics: {
      usersByRole: { doctor: 2, patient: 5, hospital: 1, admin: 1 },
      totalAppointments: 12,
      pendingVerificationsCount: 1,
    },
    pendingVerifications: [
      {
        id: 101,
        target_type: 'doctor',
        target_id: 1,
        user_id: 4,
        entity_name: 'Dr. Daniel Park',
        applicant_email: 'dr.daniel@cares.org',
        submitted_license_number: 'PMC-8492-2015',
        status: 'pending',
        created_at: '2026-10-28 10:00:00',
      },
    ],
    recentAuditEvents: [
      {
        id: 1,
        action: 'DOCTOR_AVAILABILITY_UPDATED',
        target_type: 'DOCTOR',
        target_id: 1,
        details: { slotsCount: 2 },
        ip_address: '127.0.0.1',
        created_at: '2026-10-28 10:05:00',
        actor_email: 'dr.daniel@cares.org',
      },
    ],
  };

  it('renders loading state initially', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: { id: 1, email: 'admin@cares.org', role: 'admin' },
      isAuthenticated: true,
      logout: vi.fn(),
    });

    vi.spyOn(api, 'get').mockReturnValue(new Promise(() => {}));

    render(
      <MemoryRouter>
        <AdminDashboard />
      </MemoryRouter>
    );

    expect(screen.getByText(/Loading administration console.../i)).toBeTruthy();
  });

  it('renders metrics, pending verifications, and audit logs on successful fetch', async () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: { id: 1, email: 'admin@cares.org', role: 'admin' },
      isAuthenticated: true,
      logout: vi.fn(),
    });

    vi.spyOn(api, 'get').mockImplementation((endpoint) => {
      if (endpoint === '/admin/dashboard') {
        return Promise.resolve({ success: true, data: mockAdminData });
      }
      if (endpoint === '/admin/verifications') {
        return Promise.resolve({ success: true, data: { verifications: mockAdminData.pendingVerifications } });
      }
      return Promise.resolve({ success: true, data: {} });
    });

    render(
      <MemoryRouter>
        <AdminDashboard />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Dr. Daniel Park')).toBeTruthy();
      expect(screen.getByText(/PMC-8492-2015/i)).toBeTruthy();
      expect(screen.getByText(/DOCTOR_AVAILABILITY_UPDATED/i)).toBeTruthy();
    });
  });

  it('renders error notice when API call fails', async () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: { id: 1, email: 'admin@cares.org', role: 'admin' },
      isAuthenticated: true,
      logout: vi.fn(),
    });

    vi.spyOn(api, 'get').mockRejectedValue(new Error('Admin unauthorized'));

    render(
      <MemoryRouter>
        <AdminDashboard />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Failed to load admin data: Admin unauthorized/i)).toBeTruthy();
    });
  });

  it('opens review modal and submits verification decision via POST /api/admin/verifications/:id/review', async () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: { id: 1, email: 'admin@cares.org', role: 'admin' },
      isAuthenticated: true,
      logout: vi.fn(),
    });

    vi.spyOn(api, 'get').mockImplementation((endpoint) => {
      if (endpoint === '/admin/dashboard') {
        return Promise.resolve({ success: true, data: mockAdminData });
      }
      if (endpoint === '/admin/verifications') {
        return Promise.resolve({ success: true, data: { verifications: mockAdminData.pendingVerifications } });
      }
      return Promise.resolve({ success: true, data: {} });
    });

    const postSpy = vi.spyOn(api, 'post').mockResolvedValue({
      success: true,
      data: { id: 101, status: 'approved' },
    });

    render(
      <MemoryRouter>
        <AdminDashboard />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Dr. Daniel Park')).toBeTruthy();
    });

    // Click Approve button on the pending verification item
    const approveBtn = screen.getByText(/✓ Approve/i);
    fireEvent.click(approveBtn);

    // Modal dialog opens
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeTruthy();
      expect(screen.getByText(/Confirm Review Action:/i)).toBeTruthy();
    });

    // Provide required administrative note
    const noteInput = screen.getByPlaceholderText(/Record primary source verification notes/i);
    fireEvent.change(noteInput, { target: { value: 'Verified license with state medical council.' } });

    // Confirm decision
    const confirmBtn = screen.getByText(/Confirm approved/i);
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(postSpy).toHaveBeenCalledWith('/admin/verifications/101/review', expect.objectContaining({
        decision: 'approved',
      }));
    });
  });
});
