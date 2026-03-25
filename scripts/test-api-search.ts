async function run() {
  const res = await fetch('http://localhost:3002/api/patients/search?q=fatima');
  const items = await res.json();
  console.log("API response items:", items.map((i: any) => ({
    id: i.id,
    firstName: i.firstName,
    fatherName: i.fatherName,
    lastName: i.lastName
  })));
  process.exit();
}
run();
