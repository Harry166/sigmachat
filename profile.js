document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/login.html';
        return;
    }

    const profileUsername = document.getElementById('profileUsername');
    const profileAvatar = document.getElementById('profileAvatar');
    const avatarInput = document.getElementById('avatarInput');
    const coverInput = document.getElementById('coverInput');
    const editProfileBtn = document.getElementById('editProfileBtn');
    const editProfileModal = document.getElementById('editProfileModal');
    const editProfileForm = document.getElementById('editProfileForm');
    const userPosts = document.getElementById('userPosts');

    // Load profile data
    async function loadProfile() {
        try {
            const userId = new URLSearchParams(window.location.search).get('id') || 'me';
            const response = await fetch(`/api/users/${userId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            const user = await response.json();

            profileUsername.textContent = user.username;
            profileAvatar.src = user.avatar.startsWith('http') 
                ? user.avatar 
                : `/uploads/${user.avatar}`;

            // Show/hide edit button for own profile
            editProfileBtn.style.display = userId === 'me' ? 'block' : 'none';

            loadUserPosts(user._id);
        } catch (error) {
            console.error('Error loading profile:', error);
        }
    }

    // Handle avatar upload
    avatarInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('avatar', file);

        try {
            const response = await fetch('/api/users/me', {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });
            if (!response.ok) throw new Error('Failed to update avatar');

            const result = await response.json();
            profileAvatar.src = `/uploads/${result.avatar}`;
        } catch (error) {
            console.error('Error updating avatar:', error);
        }
    });

    // Handle profile edit
    editProfileBtn.addEventListener('click', () => {
        editProfileModal.style.display = 'block';
    });

    editProfileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('editUsername').value;
        const bio = document.getElementById('editBio').value;

        try {
            const response = await fetch('/api/users/me', {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, bio })
            });
            if (!response.ok) throw new Error('Failed to update profile');

            const result = await response.json();
            profileUsername.textContent = result.username;
            editProfileModal.style.display = 'none';
        } catch (error) {
            console.error('Error updating profile:', error);
        }
    });

    // Load user's posts
    async function loadUserPosts(userId) {
        try {
            const response = await fetch(`/api/users/${userId}/posts`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            const posts = await response.json();
            
            userPosts.innerHTML = '';
            posts.forEach(post => {
                userPosts.appendChild(createPostElement(post));
            });
        } catch (error) {
            console.error('Error loading posts:', error);
        }
    }

    // Initial load
    loadProfile();
}); 