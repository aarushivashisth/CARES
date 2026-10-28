import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import HospitalDiscovery, { HospitalCard } from '../HospitalDiscovery.jsx';
import { normalizeDepartmentName } from '../utils/hospitalUtils.js';
import HospitalDetail from '../HospitalDetail.jsx';
import { api } from '../services/apiClient.js';
import * as AuthContextModule from '../context/useAuth.js';

// Mock AuthContext
vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
  user: null,
  isAuthenticated: false,
  role: null,
});

describe('Milestone 4 & 4.1: Patient-Facing Hospital Discovery, Details & Data Integrity', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: null,
      isAuthenticated: false,
      role: null,
    });
  });

  afterEach(() => {
    cleanup();
  });

  const mockHospitals = [
    {
      id: 1,
      name: 'City Care Hospital',
      address: 'Sector 16',
      city: 'Chandigarh',
      state: 'Chandigarh',
      phone: '+91-172-2756565',
      websiteUrl: 'https://example.com/citycare',
      operatingHours: { regular: '08:00 - 20:00', emergency: '24/7' },
      crowdLevel: 'Moderate',
      emergencyAvailable: true,
      departments: [{ name: 'Internal Medicine', wait: '15 min' }, { name: 'Cardiology' }, 'Pediatrics'],
      isVerified: true,
      verificationStatus: 'verified',
      isSynthetic: true,
      provenanceStatus: 'synthetic_demo',
      doctorCount: 2,
    },
    {
      id: 3,
      name: 'Postgraduate Institute of Medical Education and Research (PGIMER)',
      address: 'Sector 12',
      city: 'Chandigarh',
      state: 'Chandigarh',
      phone: '+91-172-2756565',
      websiteUrl: 'https://pgimer.edu.in',
      operatingHours: { regular: '08:00 - 17:00', emergency: '24/7', opd: '08:00 - 11:00' },
      crowdLevel: null,
      emergencyAvailable: true,
      departments: ['Internal Medicine', 'Hepatology', 'Cardiology', 'Neurology', 'Oncology'],
      isVerified: false,
      verificationStatus: 'unverified',
      isSynthetic: false,
      provenanceStatus: 'publicly_sourced',
      sourceUrl: 'https://pgimer.edu.in',
      sourceOrganization: 'PGIMER Official Web Portal',
      lastCheckedDate: '2026-10-27',
      doctorCount: 3,
    },
    {
      id: 5,
      name: 'Verified Regional Medical Institute',
      address: 'Sector 62',
      city: 'SAS Nagar (Mohali)',
      state: 'Punjab',
      phone: '+91-172-5551234',
      websiteUrl: 'https://example.com/verified',
      operatingHours: { regular: '09:00 - 18:00', emergency: 'Non-Emergency' },
      crowdLevel: null,
      emergencyAvailable: false,
      departments: ['Dermatology', 'Ophthalmology'],
      isVerified: true,
      verificationStatus: 'verified',
      isSynthetic: false,
      provenanceStatus: 'cares_verified',
      doctorCount: 1,
    },
    {
      id: 6,
      name: 'Community Wellness Clinic',
      address: 'Sector 44',
      city: 'Chandigarh',
      state: 'Chandigarh',
      phone: null,
      websiteUrl: null,
      operatingHours: null,
      crowdLevel: null,
      emergencyAvailable: null, // Unknown emergency status
      departments: [],
      isVerified: false,
      verificationStatus: 'unverified',
      isSynthetic: false,
      provenanceStatus: 'publicly_sourced',
      doctorCount: 0,
    },
  ];

  describe('Department Normalization (Milestone 4.1 Requirement 3)', () => {
    it('handles string arrays, object arrays, empty arrays, null, and malformed entries safely', () => {
      expect(normalizeDepartmentName('Cardiology')).toBe('Cardiology');
      expect(normalizeDepartmentName('   Neurology   ')).toBe('Neurology');
      expect(normalizeDepartmentName({ name: 'Internal Medicine', wait: '10 min' })).toBe('Internal Medicine');
      expect(normalizeDepartmentName({ title: 'Orthopedics' })).toBe('Orthopedics');
      expect(normalizeDepartmentName(null)).toBeNull();
      expect(normalizeDepartmentName(undefined)).toBeNull();
      expect(normalizeDepartmentName('')).toBeNull();
      expect(normalizeDepartmentName('   ')).toBeNull();
      expect(normalizeDepartmentName({})).toBeNull();
      expect(normalizeDepartmentName({ foo: 'bar' })).toBeNull();
      expect(normalizeDepartmentName(12345)).toBeNull();
    });

    it('renders object-based departments safely without crashing', () => {
      render(
        <MemoryRouter>
          <HospitalCard hospital={mockHospitals[0]} />
        </MemoryRouter>
      );

      // Successfully extracts department names from both objects and strings
      expect(screen.getByText('Internal Medicine')).toBeDefined();
      expect(screen.getByText('Cardiology')).toBeDefined();
      expect(screen.getByText('Pediatrics')).toBeDefined();
    });
  });

  describe('Crowd Level Handling (Milestone 4.1 Requirement 2)', () => {
    it('does NOT display a crowd level badge for publicly sourced facilities', () => {
      render(
        <MemoryRouter>
          <HospitalCard hospital={mockHospitals[1]} />
        </MemoryRouter>
      );

      // Public facility must NOT display any crowd level badge
      expect(screen.queryByText(/Crowd:/i)).toBeNull();
      expect(screen.queryByText(/Demo Crowd:/i)).toBeNull();
    });

    it('displays demo crowd level ONLY for synthetic demo facilities with explicit demo label', () => {
      render(
        <MemoryRouter>
          <HospitalCard hospital={mockHospitals[0]} />
        </MemoryRouter>
      );

      expect(screen.getByText('Demo Crowd: Moderate')).toBeDefined();
    });
  });

  describe('Emergency Guidance & Messaging (Milestone 4.1 Requirement 4)', () => {
    it('renders emergency guidance notice banner mentioning 112 on directory view', async () => {
      vi.spyOn(api, 'get').mockResolvedValue({
        success: true,
        data: mockHospitals,
      });

      render(
        <MemoryRouter initialEntries={['/hospitals']}>
          <HospitalDiscovery />
        </MemoryRouter>
      );

      const notice = await screen.findByRole('region', { name: /Emergency and Public Directory Notice/i });
      expect(notice).toBeDefined();
      expect(screen.getByText(/In a life-threatening medical emergency, call/i)).toBeDefined();
      expect(screen.getByText(/112/)).toBeDefined();
    });

    it('displays emergency badge variations correctly (true, false, null)', () => {
      const { rerender } = render(
        <MemoryRouter>
          <HospitalCard hospital={mockHospitals[1]} />
        </MemoryRouter>
      );
      // Emergency: true
      expect(screen.getByText('🚨 24/7 Emergency (Directory Reported)')).toBeDefined();

      // Emergency: false (checks specific title or badge)
      rerender(
        <MemoryRouter>
          <HospitalCard hospital={mockHospitals[2]} />
        </MemoryRouter>
      );
      expect(screen.getByTitle('No dedicated 24/7 emergency unit')).toBeDefined();

      // Emergency: null (unknown/not stated)
      rerender(
        <MemoryRouter>
          <HospitalCard hospital={mockHospitals[3]} />
        </MemoryRouter>
      );
      expect(screen.getByText('Emergency: Not Stated')).toBeDefined();
    });
  });

  describe('Hospital Directory (`/hospitals`)', () => {
    it('fetches and renders hospital directory cards with address and departments', async () => {
      vi.spyOn(api, 'get').mockResolvedValue({
        success: true,
        data: mockHospitals,
      });

      render(
        <MemoryRouter initialEntries={['/hospitals']}>
          <HospitalDiscovery />
        </MemoryRouter>
      );

      const pgimerHeading = await screen.findByText(/Postgraduate Institute of Medical Education and Research/);
      expect(pgimerHeading).toBeDefined();

      const cityCareHeading = await screen.findByText('City Care Hospital');
      expect(cityCareHeading).toBeDefined();

      expect(screen.getByText(/Sector 12, Chandigarh/)).toBeDefined();
      expect(screen.getByText('Hepatology')).toBeDefined();
    });

    it('handles API loading and error states gracefully', async () => {
      vi.spyOn(api, 'get').mockRejectedValue(new Error('Network connection timeout'));

      render(
        <MemoryRouter initialEntries={['/hospitals']}>
          <HospitalDiscovery />
        </MemoryRouter>
      );

      const errorMessage = await screen.findByRole('alert');
      expect(errorMessage).toBeDefined();
      expect(screen.getByText(/Network connection timeout/)).toBeDefined();
      expect(screen.getByRole('button', { name: 'Try Again' })).toBeDefined();
    });

    it('filters facilities by text search and provides a reset button on empty match', async () => {
      vi.spyOn(api, 'get').mockResolvedValue({
        success: true,
        data: mockHospitals,
      });

      render(
        <MemoryRouter initialEntries={['/hospitals']}>
          <HospitalDiscovery />
        </MemoryRouter>
      );

      await screen.findByText('City Care Hospital');

      const searchInput = screen.getByLabelText(/Hospital or Facility Name/i);
      fireEvent.change(searchInput, { target: { value: 'PGIMER' } });

      expect(screen.getByText(/Postgraduate Institute of Medical Education and Research/)).toBeDefined();
      expect(screen.queryByText('City Care Hospital')).toBeNull();

      fireEvent.change(searchInput, { target: { value: 'NonExistentFacility123' } });

      const emptyHeading = await screen.findByText('No healthcare facilities found');
      expect(emptyHeading).toBeDefined();

      const resetBtn = screen.getByRole('button', { name: 'Reset all filters' });
      fireEvent.click(resetBtn);

      expect(await screen.findByText('City Care Hospital')).toBeDefined();
    });

    it('filters facilities using city and emergency controls and calls API with query params', async () => {
      const getSpy = vi.spyOn(api, 'get').mockResolvedValue({
        success: true,
        data: [mockHospitals[1]],
      });

      render(
        <MemoryRouter initialEntries={['/hospitals']}>
          <HospitalDiscovery />
        </MemoryRouter>
      );

      await screen.findByText(/Postgraduate Institute of Medical Education and Research/);

      const citySelect = screen.getByLabelText(/City \/ Region/i);
      const emergencyCheckbox = screen.getByLabelText(/24\/7 Emergency Care Only/i);

      await act(async () => {
        fireEvent.change(citySelect, { target: { value: 'Chandigarh' } });
        fireEvent.click(emergencyCheckbox);
      });

      expect(getSpy).toHaveBeenCalledWith(expect.stringContaining('city=Chandigarh'));
      expect(getSpy).toHaveBeenCalledWith(expect.stringContaining('emergency=true'));
    });
  });

  describe('Provenance and Verification Badges (Milestone 4.1 Requirement 1)', () => {
    it('synthetic demo facility renders Demo Data badge and NEVER genuine verified badge', () => {
      render(
        <MemoryRouter>
          <HospitalCard hospital={mockHospitals[0]} />
        </MemoryRouter>
      );

      expect(screen.getByText('Demo Data')).toBeDefined();
      expect(screen.queryByText('✓ Verified')).toBeNull();
    });

    it('publicly sourced facility renders Official Sourced and Not Verified badge', () => {
      render(
        <MemoryRouter>
          <HospitalCard hospital={mockHospitals[1]} />
        </MemoryRouter>
      );

      expect(screen.getByText('Official Sourced')).toBeDefined();
      expect(screen.getByText('Not Verified')).toBeDefined();
      expect(screen.queryByText('✓ Verified')).toBeNull();
      expect(screen.queryByText('Demo Data')).toBeNull();
    });

    it('genuinely CARES-verified facility renders verified badge', () => {
      render(
        <MemoryRouter>
          <HospitalCard hospital={mockHospitals[2]} />
        </MemoryRouter>
      );

      expect(screen.getByText('✓ Verified')).toBeDefined();
      expect(screen.queryByText('Demo Data')).toBeNull();
      expect(screen.queryByText('Not Verified')).toBeNull();
    });
  });

  describe('Hospital Details View (`/hospitals/:id`)', () => {
    const mockDetailPGIMER = {
      ...mockHospitals[1],
      affiliatedDoctors: [
        {
          id: 4,
          fullName: 'Prof. (Dr.) Sanjay Jain',
          specialty: 'Internal Medicine',
          qualifications: 'MBBS, MD, FICP',
          experienceYears: 28,
          affiliationRole: 'Head of Department',
          isVerified: false,
          verificationStatus: 'unverified',
          isSynthetic: false,
          provenanceStatus: 'publicly_sourced',
        },
        {
          id: 1,
          fullName: 'Dr. Maya Bennett',
          specialty: 'Primary Care',
          qualifications: 'MBBS, MD',
          experienceYears: 10,
          affiliationRole: 'Visiting Consultant',
          isVerified: true,
          verificationStatus: 'verified',
          isSynthetic: true,
          provenanceStatus: 'synthetic_demo',
        },
      ],
    };

    it('renders facility information, operating hours, emergency advisory, schedule disclaimer, and affiliated doctors', async () => {
      vi.spyOn(api, 'get').mockResolvedValue({
        success: true,
        data: mockDetailPGIMER,
      });

      render(
        <MemoryRouter initialEntries={['/hospitals/3']}>
          <Routes>
            <Route path="/hospitals/:id" element={<HospitalDetail />} />
          </Routes>
        </MemoryRouter>
      );

      const title = await screen.findByText(/Postgraduate Institute of Medical Education and Research/);
      expect(title).toBeDefined();

      // Emergency banner on detail view
      expect(screen.getByRole('region', { name: /Emergency and Public Directory Notice/i })).toBeDefined();

      // Provenance badges on detail view
      expect(screen.getByText('Official Sourced')).toBeDefined();
      expect(screen.getAllByText('Not Verified').length).toBeGreaterThan(0);
      expect(screen.queryByText('Demo Record')).toBeNull();

      // Public facility does NOT display crowd level
      expect(screen.queryByText(/Crowd Level:/i)).toBeNull();

      // Operating hours & schedule disclaimer
      expect(screen.getByText('08:00 - 17:00')).toBeDefined();
      expect(screen.getByText(/Operating hours reflect static public directory records/i)).toBeDefined();

      // Contact info
      expect(screen.getByText('+91-172-2756565')).toBeDefined();
      expect(screen.getByText(/Official Website ↗/)).toBeDefined();

      // Affiliated doctors list
      expect(screen.getByText('Prof. (Dr.) Sanjay Jain')).toBeDefined();
      expect(screen.getByText('Head of Department')).toBeDefined();
      expect(screen.getByText('Dr. Maya Bennett')).toBeDefined();

      // Links to doctor profiles
      const profileLinks = screen.getAllByText('View Profile →');
      expect(profileLinks.length).toBe(2);
      expect(profileLinks[0].getAttribute('href')).toBe('/doctors/4');
      expect(profileLinks[1].getAttribute('href')).toBe('/doctors/1');
    });

    it('handles non-numeric ID by immediately displaying Facility Not Found', async () => {
      render(
        <MemoryRouter initialEntries={['/hospitals/invalid-slug']}>
          <Routes>
            <Route path="/hospitals/:id" element={<HospitalDetail />} />
          </Routes>
        </MemoryRouter>
      );

      const notFoundHeading = await screen.findByText('Facility Not Found');
      expect(notFoundHeading).toBeDefined();
      expect(screen.getByText('← Back to Hospital Directory')).toBeDefined();
    });

    it('handles 404 response from API gracefully', async () => {
      const err = new Error('Facility not found');
      err.status = 404;
      vi.spyOn(api, 'get').mockRejectedValue(err);

      render(
        <MemoryRouter initialEntries={['/hospitals/999']}>
          <Routes>
            <Route path="/hospitals/:id" element={<HospitalDetail />} />
          </Routes>
        </MemoryRouter>
      );

      const notFoundHeading = await screen.findByText('Facility Not Found');
      expect(notFoundHeading).toBeDefined();
    });
  });
});
