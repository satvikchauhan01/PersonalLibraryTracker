import api from './api';

const uploadFile = async (endpoint, file) => {
  const formData = new FormData();
  formData.append('image', file);
  const { data } = await api.post(`/upload/${endpoint}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data.url;
};

export const uploadAvatar = (file) => uploadFile('avatar', file);
export const uploadBookCover = (file) => uploadFile('book-cover', file);
export const uploadDiaryImage = (file) => uploadFile('diary-image', file);
