async function run() {
  const res = await fetch('http://localhost:3002/api/billing');
  const a = await res.json();
  console.log(a.items.filter(i => i.totalAmount === '0.00'));
}
run();
