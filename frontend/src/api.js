const API_BASE = '/api';

async function request(url, options = {}) {
  const token = localStorage.getItem('token');
  const headers = { ...options.headers };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${API_BASE}${url}`, { ...options, headers });

  if (res.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
    throw new Error('Session expired');
  }

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export const api = {
  // Auth
  signup: (data) => request('/auth/signup', { method: 'POST', body: JSON.stringify(data) }),
  login: (data) => request('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  getMe: () => request('/auth/me'),
  updateProfile: (data) => request('/auth/me', { method: 'PUT', body: JSON.stringify(data) }),

  // Families
  getFamilies: () => request('/families'),
  getFamily: (id) => request(`/families/${id}`),
  createFamily: (data) => request('/families', { method: 'POST', body: JSON.stringify(data) }),
  updateFamily: (id, data) => request(`/families/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  inviteMember: (familyId, data) => request(`/families/${familyId}/invite`, { method: 'POST', body: JSON.stringify(data) }),
  resendInvite: (familyId, inviteId) => request(`/families/${familyId}/invite/${inviteId}/resend`, { method: 'POST' }),
  deleteInvite: (familyId, inviteId) => request(`/families/${familyId}/invites/${inviteId}`, { method: 'DELETE' }),
  getInvites: (familyId) => request(`/families/${familyId}/invites`),
  getInviteInfo: (token) => request(`/families/invite-info/${token}`),
  joinFamily: (token) => request(`/families/join/${token}`, { method: 'POST' }),
  removeMember: (familyId, userId) => request(`/families/${familyId}/members/${userId}`, { method: 'DELETE' }),
  leaveFamily: (familyId) => request(`/families/${familyId}/leave`, { method: 'POST' }),

  // Documents
  uploadDocument: (formData) => request('/documents', { method: 'POST', body: formData }),
  getDocuments: (familyId) => request(`/documents/family/${familyId}`),
  getDocument: (id) => request(`/documents/${id}`),
  updateDocument: (id, data) => request(`/documents/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteDocument: (id) => request(`/documents/${id}`, { method: 'DELETE' }),
  getDashboard: (familyId) => request(`/documents/dashboard/${familyId}`),

  // External sharing
  createExternalShare: (docId, data) => request(`/documents/${docId}/share`, { method: 'POST', body: JSON.stringify(data) }),
  getDocumentShares: (docId) => request(`/documents/${docId}/shares`),
  revokeShare: (shareId) => request(`/documents/shares/${shareId}`, { method: 'DELETE' }),
  getSharedDocument: (token) => request(`/documents/shared/${token}`),

  // Notifications
  getNotifications: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/notifications${query ? '?' + query : ''}`);
  },
  markRead: (id) => request(`/notifications/${id}/read`, { method: 'PUT' }),
  markAllRead: (data) => request('/notifications/read-all', { method: 'PUT', body: JSON.stringify(data) }),
};
