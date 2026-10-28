import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import DoctorDiscovery from '../DoctorDiscovery.jsx';
import DoctorProfile from '../DoctorProfile.jsx';
import { api } from '../services/apiClient.js';
import * as AuthContextModule from '../context/useAuth.js';

// Mock AuthContext
vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
  user: null,
  isAuthenticated: false,
  role: null,
});

describe('Milestone 3.2: Automated Frontend Verification-Badge Component Tests', () => {
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

  describe('Discovery Cards Badge Rendering', () => {
    it('synthetic demo provider never receives genuine verified badge and displays Demo Data label', async () => {
      const mockSyntheticDoc = {
        id: 1,
        name: 'Dr. Synthetic Demo',
        specialty: 'Primary Care',
        rating: 4.9,
        reviews: 120,
        experience: 10,
        accepting: true,
        accessible: true,
        availability: ['Next 3 days'],
        isSynthetic: true,
        isVerified: true, // Legacy seed flag
        verificationStatus: 'verified',
        provenanceStatus: 'synthetic_demo',
        slots: ['09:00 AM'],
        languages: ['English'],
        visitTypes: ['In-person'],
      };

      vi.spyOn(api, 'get').mockResolvedValue({
        success: true,
        data: [mockSyntheticDoc],
      });

      render(
        <MemoryRouter initialEntries={['/doctors']}>
          <DoctorDiscovery />
        </MemoryRouter>
      );

      // Await asynchronous state update and element appearance
      const demoBadge = await screen.findByText('Demo Data');
      expect(demoBadge).toBeDefined();

      // Synthetic records must NEVER display genuine verified badge
      const verifiedBadge = screen.queryByText('✓ Verified');
      expect(verifiedBadge).toBeNull();
    });

    it('publicly sourced unverified provider displays Official Sourced and Not Verified, never verified badge', async () => {
      const mockPublicDoc = {
        id: 4,
        name: 'Prof. Public Doctor',
        specialty: 'Cardiology',
        rating: 4.8,
        reviews: 45,
        experience: 25,
        accepting: true,
        accessible: true,
        availability: ['Next 3 days'],
        isSynthetic: false,
        isVerified: false,
        verificationStatus: 'unverified',
        provenanceStatus: 'publicly_sourced',
        slots: ['10:00 AM'],
        languages: ['English', 'Hindi'],
        visitTypes: ['In-person'],
      };

      vi.spyOn(api, 'get').mockResolvedValue({
        success: true,
        data: [mockPublicDoc],
      });

      render(
        <MemoryRouter initialEntries={['/doctors']}>
          <DoctorDiscovery />
        </MemoryRouter>
      );

      // Publicly sourced directory records display "Official Sourced"
      const sourcedBadge = await screen.findByText('Official Sourced');
      expect(sourcedBadge).toBeDefined();

      // Unverified records display "Not Verified"
      const unverifiedBadge = await screen.findByText('Not Verified');
      expect(unverifiedBadge).toBeDefined();

      // Must not display "✓ Verified"
      const verifiedBadge = screen.queryByText('✓ Verified');
      expect(verifiedBadge).toBeNull();
    });
  });

  describe('Doctor Profile View Badge Rendering', () => {
    it('synthetic demo provider renders Demo Record badge on profile view, never verified badge', async () => {
      const mockSyntheticDoc = {
        id: 1,
        name: 'Dr. Maya Bennett',
        specialty: 'Primary Care',
        rating: 4.9,
        reviews: 128,
        isSynthetic: true,
        isVerified: true, // Legacy seed flag
        verificationStatus: 'verified',
        provenanceStatus: 'synthetic_demo',
        slots: ['09:00 AM'],
      };

      vi.spyOn(api, 'get').mockResolvedValue({
        success: true,
        data: mockSyntheticDoc,
      });

      render(
        <MemoryRouter initialEntries={['/doctors/1']}>
          <Routes>
            <Route path="/doctors/:id" element={<DoctorProfile />} />
          </Routes>
        </MemoryRouter>
      );

      const demoRecordBadge = await screen.findByText('Demo Record');
      expect(demoRecordBadge).toBeDefined();

      const verifiedBadge = screen.queryByText('✓ Verified');
      expect(verifiedBadge).toBeNull();
    });

    it('publicly sourced unverified clinician renders Not Verified on profile view, never verified badge', async () => {
      const mockPublicDoc = {
        id: 4,
        name: 'Prof. (Dr.) Sanjay Jain',
        specialty: 'Internal Medicine',
        isSynthetic: false,
        isVerified: false,
        verificationStatus: 'unverified',
        provenanceStatus: 'publicly_sourced',
        slots: ['10:00 AM'],
      };

      vi.spyOn(api, 'get').mockResolvedValue({
        success: true,
        data: mockPublicDoc,
      });

      render(
        <MemoryRouter initialEntries={['/doctors/4']}>
          <Routes>
            <Route path="/doctors/:id" element={<DoctorProfile />} />
          </Routes>
        </MemoryRouter>
      );

      const unverifiedBadge = await screen.findByText('Not Verified');
      expect(unverifiedBadge).toBeDefined();

      const verifiedBadge = screen.queryByText('✓ Verified');
      expect(verifiedBadge).toBeNull();
    });

    it('genuinely CARES-verified, non-synthetic provider renders verified badge on profile view', async () => {
      const mockVerifiedDoc = {
        id: 10,
        name: 'Dr. Real Verified Clinician',
        specialty: 'Pediatrics',
        isSynthetic: false,
        isVerified: true,
        verificationStatus: 'verified',
        provenanceStatus: 'cares_verified',
        slots: ['11:00 AM'],
      };

      vi.spyOn(api, 'get').mockResolvedValue({
        success: true,
        data: mockVerifiedDoc,
      });

      render(
        <MemoryRouter initialEntries={['/doctors/10']}>
          <Routes>
            <Route path="/doctors/:id" element={<DoctorProfile />} />
          </Routes>
        </MemoryRouter>
      );

      const verifiedBadge = await screen.findByText('✓ Verified');
      expect(verifiedBadge).toBeDefined();

      const demoBadge = screen.queryByText('Demo Record');
      expect(demoBadge).toBeNull();
    });
  });
});
