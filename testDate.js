const days = 10;
const result = [];
const today = new Date('2026-09-10T12:00:00');
for (let i = days - 1; i >= 0; i--) {
  const d = new Date();
  d.setDate(today.getDate() - i);
  const localStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  result.push(localStr);
}
console.log(result);
