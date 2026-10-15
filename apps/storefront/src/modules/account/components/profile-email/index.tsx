import type { HttpTypes } from "@medusajs/types"

type MyInformationProps = {
  customer: HttpTypes.StoreCustomer
}

const ProfileEmail = ({ customer }: MyInformationProps) => {
  return (
    <div className="text-small-regular" data-testid="account-email-readonly">
      <span className="uppercase text-ui-fg-base">Email</span>
      <p className="font-semibold" data-testid="current-info">
        {customer.email}
      </p>
      <p className="mt-2 text-ui-fg-subtle">
        Адрес используется для входа. Его изменение в личном кабинете
        недоступно.
      </p>
    </div>
  )
}

export default ProfileEmail
