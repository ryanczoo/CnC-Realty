interface Props {
  syncedAt: string | null;
  className?: string;
}

export function CrmlsDisclaimer({ syncedAt, className }: Props) {
  const date = syncedAt
    ? new Date(syncedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : "the date listed above";

  return (
    <p className={className}>
      The multiple listing data appearing on this website is owned and copyrighted by California Regional Multiple
      Listing Service, Inc. (&quot;CRMLS&quot;) and is protected by all applicable copyright laws. Based on
      information from CRMLS as of {date}. This information is for your personal, non-commercial use and may not be
      used for any purpose other than to identify prospective properties you may be interested in purchasing. All
      listing data, including but not limited to square footage and lot size, is believed to be accurate but is not
      guaranteed by the listing Agent, listing Broker, or CRMLS. Buyers are responsible for verifying the accuracy of
      all information and should independently investigate the data or retain appropriate professionals prior to making
      any decisions. Information from sources other than the Listing Agent may have been included in the MLS data.
      Unless otherwise specified in writing, Broker/Agent has not and will not verify any information obtained from
      other sources. The Broker/Agent providing the information herein may or may not have been the Listing and/or
      Selling Agent. Properties may or may not be listed by the office/agent presenting the information. The listing
      broker&apos;s offer of compensation is made only to participants of the MLS where the listing is filed.
    </p>
  );
}
