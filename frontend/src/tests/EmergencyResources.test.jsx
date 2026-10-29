import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, act, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import EmergencyResources from '../pages/EmergencyResources.jsx';
import Navbar from '../Navbar.jsx';
import Footer from '../Footer.jsx';
import App from '../App.jsx';
import { api } from '../services/apiClient.js';
import * as AuthContextModule from '../context/useAuth.js';

// Mock AuthContext
vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
  user: null,
  isAuthenticated: false,
  role: null,
  logout: vi.fn(),
});

describe('Phase 3: Emergency Resources Page & Navigation (/emergency)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: null,
      isAuthenticated: false,
      role: null,
      logout: vi.fn(),
    });
  });

  afterEach(() => {
    cleanup();
  });

  const mockEmergencyHospitals = [
    {
      id: 1,
      name: 'City Care Hospital',
      address: 'Sector 16',
      city: 'Chandigarh',
      state: 'Chandigarh',
      phone: '+91-172-2756565',
      websiteUrl: 'https://example.com/citycare',
      operatingHours: { regular: '08:00 - 20:00', emergency: '24/7' },
      emergencyAvailable: true,
      departments: ['Emergency Medicine', 'Cardiology'],
      isVerified: true,
      verificationStatus: 'verified',
      isSynthetic: true,
      provenanceStatus: 'synthetic_demo',
      doctorCount: 3,
    },
    {
      id: 3,
      name: 'Postgraduate Institute of Medical Education and Research (PGIMER)',
      address: 'Sector 12',
      city: 'Chandigarh',
      state: 'Chandigarh',
      phone: '+91-172-2756565',
      websiteUrl: 'https://pgimer.edu.in',
      operatingHours: { regular: '08:00 - 17:00', emergency: '24/7' },
      emergencyAvailable: true,
      departments: ['Trauma Center', 'Advanced Cardiac Centre'],
      isVerified: true,
      verificationStatus: 'verified',
      isSynthetic: false,
      provenanceStatus: 'publicly_sourced',
      doctorCount: 8,
    },
  ];

  it('renders hero banner with calm instructions, disclaimer, and prominent 112/108 quick-dial links', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({
      success: true,
      data: mockEmergencyHospitals,
    });

    render(
      <MemoryRouter initialEntries={['/emergency']}>
        <EmergencyResources />
      </MemoryRouter>
    );

    // Title & subtitle
    expect(
      screen.getByRole('heading', { level: 1, name: /Emergency Healthcare Resources/i })
    ).toBeDefined();
    expect(
      screen.getByText(/Immediate contacts, verified hotlines, and guidance for urgent medical situations across India/i)
    ).toBeDefined();

    // Prominent disclaimer
    const disclaimer = screen.getByRole('note');
    expect(disclaimer.textContent).toContain('CARES is an academic healthcare navigation prototype and is not an emergency dispatch service');
    expect(disclaimer.textContent).toContain('112');
    expect(disclaimer.textContent).toContain('108');

    // Quick-dial links
    const dial112 = screen.getByRole('link', { name: /Call 112 National Emergency Helpline/i });
    expect(dial112.getAttribute('href')).toBe('tel:112');

    const dial108 = screen.getByRole('link', { name: /Call 108 Ambulance and Trauma Service/i });
    expect(dial108.getAttribute('href')).toBe('tel:108');

    // Wait for async fetch to finish cleanly
    await waitFor(() => {
      expect(screen.getByTestId('emergency-facility-3')).toBeDefined();
    });
  });

  it('displays all 5 verified official Indian emergency numbers with correct tel: links and official sources', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({
      success: true,
      data: mockEmergencyHospitals,
    });

    render(
      <MemoryRouter initialEntries={['/emergency']}>
        <EmergencyResources />
      </MemoryRouter>
    );

    // 112 - ERSS
    const card112 = screen.getByTestId('helpline-112');
    expect(card112.textContent).toContain('112');
    expect(card112.textContent).toContain('National Emergency Helpline (ERSS)');
    expect(card112.textContent).toContain('Emergency Response Support System (ERSS), Ministry of Home Affairs');
    expect(card112.querySelector('a').getAttribute('href')).toBe('tel:112');

    // 108 - Ambulance
    const card108 = screen.getByTestId('helpline-108');
    expect(card108.textContent).toContain('108');
    expect(card108.textContent).toContain('Ambulance & Disaster Medical Service');
    expect(card108.textContent).toContain('National Health Mission');
    expect(card108.querySelector('a').getAttribute('href')).toBe('tel:108');

    // 102 - Maternal & Child
    const card102 = screen.getByTestId('helpline-102');
    expect(card102.textContent).toContain('102');
    expect(card102.textContent).toContain('Maternal & Neonatal Transport');
    expect(card102.textContent).toContain('Janani Shishu Suraksha Karyakram');
    expect(card102.querySelector('a').getAttribute('href')).toBe('tel:102');

    // 1075 - MoHFW National Health
    const card1075 = screen.getByTestId('helpline-1075');
    expect(card1075.textContent).toContain('1075');
    expect(card1075.textContent).toContain('National Health Helpline (MoHFW)');
    expect(card1075.textContent).toContain('Ministry of Health and Family Welfare');
    expect(card1075.querySelector('a').getAttribute('href')).toBe('tel:1075');

    // 104 - State Medical Advice
    const card104 = screen.getByTestId('helpline-104');
    expect(card104.textContent).toContain('104');
    expect(card104.textContent).toContain('State Medical Advice Helpline');
    expect(card104.textContent).toContain('State Departments of Health');
    expect(card104.querySelector('a').getAttribute('href')).toBe('tel:104');

    await waitFor(() => {
      expect(screen.getByTestId('emergency-facility-3')).toBeDefined();
    });
  });

  it('renders actionable, non-diagnostic guidance steps for emergencies', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({
      success: true,
      data: mockEmergencyHospitals,
    });

    render(
      <MemoryRouter initialEntries={['/emergency']}>
        <EmergencyResources />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { level: 2, name: /What to Do in a Medical Crisis/i })).toBeDefined();
    expect(screen.getByText(/Call Responders Immediately/i)).toBeDefined();
    expect(screen.getByText(/Provide Clear Location & Landmark/i)).toBeDefined();
    expect(screen.getByText(/Keep Line Open & Follow Instructions/i)).toBeDefined();
    expect(screen.getByText(/Do Not Delay Urgent Care/i)).toBeDefined();

    await waitFor(() => {
      expect(screen.getByTestId('emergency-facility-3')).toBeDefined();
    });
  });

  it('renders directory hospitals reporting 24/7 emergency care, contact links, and badges', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({
      success: true,
      data: mockEmergencyHospitals,
    });

    render(
      <MemoryRouter initialEntries={['/emergency']}>
        <EmergencyResources />
      </MemoryRouter>
    );

    // Wait for hospitals to render
    const pgiCard = await screen.findByTestId('emergency-facility-3');
    expect(pgiCard.textContent).toContain('Postgraduate Institute of Medical Education and Research (PGIMER)');
    expect(pgiCard.textContent).toContain('24/7 Emergency (Directory Reported)');
    expect(pgiCard.textContent).toContain('Official Sourced');
    expect(pgiCard.textContent).toContain('Sector 12, Chandigarh, Chandigarh');

    // Phone link
    const phoneLink = pgiCard.querySelector('a[href^="tel:"]');
    expect(phoneLink.getAttribute('href')).toBe('tel:+911722756565');

    // Facility details link
    const detailsLink = pgiCard.querySelector('a[href="/hospitals/3"]');
    expect(detailsLink.textContent).toContain('Facility Details & Clinicians →');

    // Link to browse all hospitals
    const browseAllLink = screen.getByRole('link', { name: /Browse All Hospitals in CARES Directory →/i });
    expect(browseAllLink.getAttribute('href')).toBe('/hospitals');
  });

  it('handles loading, error with retry, and empty directory states gracefully', async () => {
    // 1. Loading state
    let resolveHospitals;
    const promise = new Promise((resolve) => {
      resolveHospitals = resolve;
    });
    vi.spyOn(api, 'get').mockReturnValue(promise);

    render(
      <MemoryRouter initialEntries={['/emergency']}>
        <EmergencyResources />
      </MemoryRouter>
    );

    expect(screen.getByTestId('emergency-loading').textContent).toContain('Loading directory hospitals with emergency care');

    // Resolve with empty array
    await act(async () => {
      resolveHospitals({ success: true, data: [] });
    });

    await waitFor(() => {
      expect(screen.getByTestId('emergency-empty').textContent).toContain('No facilities in the directory currently report 24/7 emergency services');
    });

    cleanup();

    // 2. Error state with retry
    const errorSpy = vi.spyOn(api, 'get').mockRejectedValueOnce(new Error('Network connection timeout'));

    render(
      <MemoryRouter initialEntries={['/emergency']}>
        <EmergencyResources />
      </MemoryRouter>
    );

    const errorCard = await screen.findByTestId('emergency-error');
    expect(errorCard.textContent).toContain('Network connection timeout');

    // Click retry
    errorSpy.mockResolvedValueOnce({ success: true, data: mockEmergencyHospitals });
    const retryBtn = screen.getByRole('button', { name: /Retry Loading Facilities/i });

    await act(async () => {
      fireEvent.click(retryBtn);
    });

    const loadedCard = await screen.findByTestId('emergency-facility-1');
    expect(loadedCard).toBeDefined();
  });

  it('verifies that Navbar, Footer, and HomePage route correctly to /emergency', async () => {
    // Navbar Emergency Link
    render(
      <MemoryRouter initialEntries={['/emergency']}>
        <Navbar />
      </MemoryRouter>
    );
    const navEmergencyLink = screen.getByRole('link', { name: /Emergency/i });
    expect(navEmergencyLink.getAttribute('href')).toBe('/emergency');
    expect(navEmergencyLink.className).toContain('active');

    cleanup();

    // Footer Emergency Link
    render(
      <MemoryRouter initialEntries={['/']}>
        <Footer />
      </MemoryRouter>
    );
    const footerEmergencyLink = screen.getByRole('link', { name: /Emergency guidance/i });
    expect(footerEmergencyLink.getAttribute('href')).toBe('/emergency');

    cleanup();

    // HomePage Service and Extra Features Links
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    );

    // Card 04
    const serviceCard04 = screen.getByRole('link', { name: /04 \/ WHEN IT MATTERS/i });
    expect(serviceCard04.getAttribute('href')).toBe('/emergency');

    // Extra feature card
    const extraFeatureEmergencyLink = screen.getByRole('link', { name: /View emergency guidance ↗/i });
    expect(extraFeatureEmergencyLink.getAttribute('href')).toBe('/emergency');
  });
});
