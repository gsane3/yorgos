import OfferResponseClient from './OfferResponseClient';

export default async function OfferResponsePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const token = (await params).id;
  return <OfferResponseClient token={token} />;
}
