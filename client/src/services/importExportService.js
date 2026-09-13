import api from './api';

export const importBooks = (rows) => api.post('/books/import', { rows });

// Fetches the export as a blob and triggers a browser download — axios
// doesn't follow Content-Disposition automatically, so the filename is
// pulled from the response header with a sane fallback.
export const downloadExport = async (format) => {
  const response = await api.get('/books/export', {
    params: { format },
    responseType: 'blob',
  });

  const disposition = response.headers['content-disposition'] || '';
  const match = disposition.match(/filename="?([^"]+)"?/);
  const filename = match ? match[1] : `library-export.${format}`;

  const url = URL.createObjectURL(response.data);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};
