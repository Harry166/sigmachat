document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/login.html';
        return;
    }

    const postsFeed = document.getElementById('postsFeed');
    const submitPostBtn = document.getElementById('submitPost');
    const postInput = document.getElementById('postInput');
    const imageInput = document.getElementById('imageInput');
    const userAvatar = document.getElementById('userAvatar');

    // Load user avatar
    fetchUserData().then(user => {
        userAvatar.src = user.avatar.startsWith('http') 
            ? user.avatar 
            : `/uploads/${user.avatar}`;
    });

    // Handle post submission
    submitPostBtn.addEventListener('click', async () => {
        const content = postInput.value.trim();
        if (!content && !imageInput.files[0]) return;

        const formData = new FormData();
        formData.append('content', content);
        if (imageInput.files[0]) {
            formData.append('image', imageInput.files[0]);
        }

        try {
            const response = await fetch('/api/posts', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });

            if (!response.ok) throw new Error('Failed to create post');

            postInput.value = '';
            imageInput.value = '';
            loadPosts();
        } catch (error) {
            console.error('Error creating post:', error);
        }
    });

    // Load posts
    async function loadPosts() {
        try {
            const response = await fetch('/api/posts', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            const posts = await response.json();
            
            postsFeed.innerHTML = '';
            posts.forEach(post => {
                postsFeed.appendChild(createPostElement(post));
            });
        } catch (error) {
            console.error('Error loading posts:', error);
        }
    }

    // Create post element
    function createPostElement(post) {
        const postElement = document.createElement('article');
        postElement.className = 'post';
        
        const avatarSrc = post.author.avatar.startsWith('http') 
            ? post.author.avatar 
            : `/uploads/${post.author.avatar}`;

        postElement.innerHTML = `
            <img src="${avatarSrc}" alt="Avatar" class="avatar">
            <div class="post-content">
                <div class="post-header">
                    <span class="user-name">${post.author.username}</span>
                    <span class="post-time">${formatDate(post.createdAt)}</span>
                </div>
                <p class="post-text">${post.content}</p>
                ${post.image ? `<img src="/uploads/${post.image}" class="post-image">` : ''}
                <div class="post-actions">
                    <button class="action-btn like-btn" data-post-id="${post._id}">
                        <i class="far fa-heart"></i> <span>${post.likes.length}</span>
                    </button>
                    <button class="action-btn resigma-btn" data-post-id="${post._id}">
                        <i class="fas fa-retweet"></i> <span>${post.resigmas.length}</span>
                    </button>
                </div>
            </div>
        `;

        // Add event listeners for like and resigma
        const likeBtn = postElement.querySelector('.like-btn');
        const resigmaBtn = postElement.querySelector('.resigma-btn');

        likeBtn.addEventListener('click', () => handleLike(post._id, likeBtn));
        resigmaBtn.addEventListener('click', () => handleResigma(post._id, resigmaBtn));

        return postElement;
    }

    // Handle like
    async function handleLike(postId, button) {
        try {
            const response = await fetch(`/api/posts/${postId}/like`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (!response.ok) throw new Error('Failed to like post');
            
            const icon = button.querySelector('i');
            const count = button.querySelector('span');
            if (icon.classList.contains('far')) {
                icon.classList.replace('far', 'fas');
                count.textContent = parseInt(count.textContent) + 1;
            } else {
                icon.classList.replace('fas', 'far');
                count.textContent = parseInt(count.textContent) - 1;
            }
        } catch (error) {
            console.error('Error liking post:', error);
        }
    }

    // Handle resigma
    async function handleResigma(postId, button) {
        try {
            const response = await fetch(`/api/posts/${postId}/resigma`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (!response.ok) throw new Error('Failed to resigma post');
            
            const count = button.querySelector('span');
            const icon = button.querySelector('i');
            if (icon.style.color !== 'var(--primary-color)') {
                icon.style.color = 'var(--primary-color)';
                count.textContent = parseInt(count.textContent) + 1;
            } else {
                icon.style.color = '';
                count.textContent = parseInt(count.textContent) - 1;
            }
        } catch (error) {
            console.error('Error resigma post:', error);
        }
    }

    // Utility functions
    async function fetchUserData() {
        const response = await fetch('/api/users/me', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        return response.json();
    }

    function formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric'
        });
    }

    // Initial load
    loadPosts();
}); 