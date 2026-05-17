import CustomerIntakeClient from './CustomerIntakeClient';

export default async function CustomerIntakePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CustomerIntakeClient customerId={id} />;
}
