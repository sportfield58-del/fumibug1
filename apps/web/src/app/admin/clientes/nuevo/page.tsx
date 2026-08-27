'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save, Loader2 } from 'lucide-react'
import { Button, Input, Label, Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@fumibug/ui'
import { postCreateCustomer } from '@/../../lib/api/client'

export default function NuevoClientePage(): JSX.Element {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const [type, setType] = React.useState('COMPANY')
  const [legalName, setLegalName] = React.useState('')
  const [tradeName, setTradeName] = React.useState('')
  const [taxId, setTaxId] = React.useState('')
  const [phone, setPhone] = React.useState('')
  const [email, setEmail] = React.useState('')
  const [notes, setNotes] = React.useState('')

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      const res = await postCreateCustomer({
        body: {
          type: type as 'COMPANY' | 'INDIVIDUAL',
          legalName,
          tradeName: tradeName || undefined,
          taxId: taxId || undefined,
          paymentTerms: 'CASH',
          tags: [],
          contacts: [
            {
              name: legalName,
              role: 'OWNER',
              phone: phone || undefined,
              email: email || undefined,
              isPrimary: true,
            },
          ],
        },
      })

      if (res.success) {
        router.push(`/admin/clientes/${res.data.id}`)
      } else {
        setError(res.error.message)
      }
    } catch {
      setError('Error al crear el cliente')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
          <Link href="/admin/clientes">
            <ArrowLeft className="h-4 w-4" /> Clientes
          </Link>
        </Button>
        <h1 className="text-h1 font-semibold text-fg">Nuevo cliente</h1>
      </div>

      <form onSubmit={(e) => { void handleSubmit(e) }} className="space-y-6">
        {/* Type */}
        <div className="space-y-2">
          <Label>Tipo de cliente</Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="INDIVIDUAL">Particular</SelectItem>
              <SelectItem value="COMPANY">Empresa</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Legal name */}
        <div className="space-y-2">
          <Label htmlFor="legalName">Razón social *</Label>
          <Input
            id="legalName"
            value={legalName}
            onChange={(e) => setLegalName(e.target.value)}
            required
            placeholder="Nombre legal completo"
          />
        </div>

        {/* Trade name */}
        <div className="space-y-2">
          <Label htmlFor="tradeName">Nombre comercial</Label>
          <Input
            id="tradeName"
            value={tradeName}
            onChange={(e) => setTradeName(e.target.value)}
            placeholder="Nombre por el que se conoce al cliente"
          />
        </div>

        {/* Tax ID */}
        <div className="space-y-2">
          <Label htmlFor="taxId">CUIT / CUIL</Label>
          <Input
            id="taxId"
            value={taxId}
            onChange={(e) => setTaxId(e.target.value)}
            placeholder="20-12345678-9"
            className="max-w-xs tabular-nums"
          />
        </div>

        {/* Contact */}
        <div className="rounded-lg border border-border bg-bg-elevated p-4 space-y-4">
          <h3 className="text-h3 font-semibold text-fg">Contacto principal</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="phone">Teléfono</Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+54 11 1234-5678"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="contacto@empresa.com"
              />
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="space-y-2">
          <Label htmlFor="notes">Notas</Label>
          <textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="flex w-full rounded-md border border-border-strong bg-bg px-3 py-2 text-body ring-offset-bg placeholder:text-fg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            placeholder="Información relevante sobre el cliente..."
          />
        </div>

        {error && (
          <p className="text-caption text-destructive">{error}</p>
        )}

        <div className="flex gap-3">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Guardando...</>
            ) : (
              <><Save className="h-4 w-4" /> Guardar cliente</>
            )}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancelar
          </Button>
        </div>
      </form>
    </div>
  )
}
