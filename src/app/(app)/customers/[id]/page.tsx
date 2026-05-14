import CustomerProfile from '@/components/customers/CustomerProfile';

export default async function CustomerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CustomerProfile key={id} customerId={id} />;
}
