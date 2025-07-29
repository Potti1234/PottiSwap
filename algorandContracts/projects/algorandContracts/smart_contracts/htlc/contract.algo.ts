import { Contract } from '@algorandfoundation/algorand-typescript'

export class Htlc extends Contract {
  hello(name: string): string {
    return `Hello, ${name}`
  }
}
