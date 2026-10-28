import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import HospitalDashboard from '../pages/HospitalDashboard.jsx';
import { api } from '../services/apiClient.js';
import * as AuthContextModule from '../context/useAuth.js';

describe('Milestone 7: Automated HospitalDashboard Component Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  const mockFacilityData = {
    facility: {
      id: 1,
      name: 'Riverside Community Health Center',
      address: '100 Health Way',
      city: 'Chandigarh',
      state: 'Punjab',
      phone: '555-0100',
      website_url: 'https://riverside.example.org',
      operating_hours_json: JSON.stringify({ regular: '08:00 - 20:00', emergency: '24/7 Everyday' }),
      emergency_available: 1,
      departments: ['Emergency', 'Cardiology'],
    },
    affiliatedDoctors: [
      {
        id: 1,
        full_name: 'Dr. Maya Bennett',
        specialty: 'Primary Care',
        role_at_facility: 'Lead Physician',
        isVerified: true,
      },
    ],
    availableDoctors: [
      {
        id: 2,
        full_name: 'Dr. Daniel Park',
        specialty: 'Cardiology',
      },
    ],
    metrics: {
      totalAffiliatedDoctors: 1,
      crowdStatus: 'moderate',
      emergencyActive: true,
      verifiedProviders: 1,
    },
  };

  it('renders loading state initially', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: { id: 3, email: 'hospital@riverside.org', role: 'hospital' },
      isAuthenticated: true,
      logout: vi.fn(),
    });

    vi.spyOn(api, 'get').mockReturnValue(new Promise(() => {})); // Never resolves to capture loading

    render(
      <MemoryRouter>
        <HospitalDashboard />
      </MemoryRouter>
    );

    expect(screen.getByText(/Loading facility data.../i)).toBeTruthy();
  });

  it('renders facility information and affiliated doctors on successful fetch', async () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: { id: 3, email: 'hospital@riverside.org', role: 'hospital' },
      isAuthenticated: true,
      logout: vi.fn(),
    });

    vi.spyOn(api, 'get').mockResolvedValue({
      success: true,
      data: mockFacilityData,
    });

    render(
      <MemoryRouter>
        <HospitalDashboard />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Riverside Community Health Center')).toBeTruthy();
      expect(screen.getByText(/Lead Physician/i)).toBeTruthy();
      expect(screen.getByText('Dr. Maya Bennett')).toBeTruthy();
    });
  });

  it('renders error notice when API call fails', async () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: { id: 3, email: 'hospital@riverside.org', role: 'hospital' },
      isAuthenticated: true,
      logout: vi.fn(),
    });

    vi.spyOn(api, 'get').mockRejectedValue(new Error('Network error loading facility'));

    render(
      <MemoryRouter>
        <HospitalDashboard />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Failed to load facility data: Network error loading facility/i)).toBeTruthy();
    });
  });

  it('submits updated profile settings via PUT /api/hospital/profile', async () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: { id: 3, email: 'hospital@riverside.org', role: 'hospital' },
      isAuthenticated: true,
      logout: vi.fn(),
    });

    vi.spyOn(api, 'get').mockResolvedValue({
      success: true,
      data: mockFacilityData,
    });

    const putSpy = vi.spyOn(api, 'put').mockResolvedValue({
      success: true,
      data: { ...mockFacilityData.facility, phone: '555-9999' },
    });

    render(
      <MemoryRouter>
        <HospitalDashboard />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Riverside Community Health Center')).toBeTruthy();
    });

    // Enter edit mode
    const editBtn = screen.getByText(/Edit Facility Info ✎/i);
    fireEvent.click(editBtn);

    // Update phone number
    const phoneInput = screen.getByDisplayValue('555-0100');
    fireEvent.change(phoneInput, { target: { value: '555-9999' } });

    // Save
    const saveBtn = screen.getByText(/Save Facility Details/i);
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(putSpy).toHaveBeenCalledWith('/hospital/profile', expect.objectContaining({
        phone: '555-9999',
      }));
    });
  });
});
