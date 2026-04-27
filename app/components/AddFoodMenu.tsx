"use client";

type Props = {
  onClose: () => void;
  onChoosePhoto: () => void;
  onChooseSearch: () => void;
  onChooseBarcode: () => void;
};

export default function AddFoodMenu({
  onClose,
  onChoosePhoto,
  onChooseSearch,
  onChooseBarcode,
}: Props) {
  return (
    <div
      className="fixed inset-0 z-30 flex items-end justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-3xl bg-paper p-5 pb-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-ink/15" />
        <h2 className="font-display text-2xl">Add food</h2>
        <p className="text-sm text-ink/60">Pick how you want to log it.</p>

        <div className="mt-4 space-y-2">
          <Option
            emoji="🔎"
            title="Search ingredient"
            desc='Type "raw sweet potato", "avocado flesh"…'
            onClick={onChooseSearch}
          />
          <Option
            emoji="📷"
            title="Scan barcode"
            desc="Packaged stuff — straight into your pantry."
            onClick={onChooseBarcode}
          />
          <Option
            emoji="🍽️"
            title="Photo of a meal"
            desc="Restaurant plates, finished dishes."
            onClick={onChoosePhoto}
          />
        </div>
      </div>
    </div>
  );
}

function Option({
  emoji,
  title,
  desc,
  onClick,
}: {
  emoji: string;
  title: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-4 rounded-2xl border border-ink/10 bg-white/60 p-4 text-left active:scale-[0.99]"
    >
      <span className="text-2xl">{emoji}</span>
      <span className="flex-1">
        <span className="block font-medium">{title}</span>
        <span className="block text-xs text-ink/60">{desc}</span>
      </span>
      <span className="text-ink/30">›</span>
    </button>
  );
}
