class Account {
  constructor(rotonde) {
    this.rotonde = rotonde
    this.url = ''

    this.data = {}
    this.icon = ''
  }

  async start() {
    if (!getCurrentRotonde()) {
      this.rotonde.router.push('/load/setup')
    } else {
      await this.setup()
      this.rotonde.router.push('/home')

      setInterval(() => {
        this.rotonde.updateFeed()
      }, 1000 * 30) // Update feed every 30 seconds for time and stuff
    
    }
  }

  async setup() {
    this.dat = await Dat(config.get('path'))
    this.hash = await resolveDatUrl('dat://' + this.dat.key.toString('hex') + '/')
    this.url = 'dat://' + this.hash + '/'

    this.dat.importFiles({watch: true})

    this.stats = this.dat.trackStats()

    setInterval(() => {
      this.rotonde.store.commit('speeds', {
        up: this.stats.network.uploadSpeed,
        down: this.stats.network.downloadSpeed
      })
    }, 500)

    this.activity = emitStream(pda.createFileActivityStream(this.dat.archive))
    this.activity.on('changed', this.onChange.bind(this))

    this.swarm = this.dat.join()
    this.swarm.on('connection', this.onConnection.bind(this))

    this.rotonde.store.commit('set', {
      path: 'loaded',
      value: true
    })

    this.rotonde.store.commit('key', this.dat.key)

    this.onChange()

  }

  onConnection(con, info) {
    this.rotonde.store.commit('set', {
      path: 'peers',
      value: this.swarm.connected
    })
  }

  async onChange() {

    this.icon = path.join(this.dat.path, 'media/content/icon.svg')

    try {
      var data = await pda.readFile(this.dat.archive, '/portal.json')
      //console.log(data)
      
      this.data = JSON.parse(data)

      this.rotonde.store.commit('name', this.data.name)
      this.rotonde.store.commit('desc', this.data.desc)
      this.rotonde.store.commit('site', this.data.site)
      this.rotonde.store.commit('icon', this.icon)
      
    } catch(e) {
      console.warn(e)
      // give some kind of error notification here
    }

    this.rotonde.updatePortals()

    this.rotonde.updateFeed()
  }

  async getFeed() {
    if (!this.data || !this.data.feed) return [];
    
    var feed = []
    var psl = []
    this.data.feed.forEach((entry, index) => {
      var ps = this.rotonde.createFeedEntry(this, entry, index)
        .then(entry => {
          feed.push(entry)
        })
      psl.push(ps)
    })
    
    await Promise.all(psl)

    return feed
  }

  getPortals() {
    if (!this.data || !this.data.port) return [];

    return this.data.port
  }

  async submit(input) {
    //var data = await pda.readFile(this.dat.archive, '/portal.json')
    
    //this.data = JSON.parse(data)

    this.data.feed.push({
      message: input.message,
      target: input.target ? input.target : undefined,
      timestamp: Date.now()
    })

    //console.log(this.data)

    fs.writeFileSync(path.join(this.dat.path, 'portal.json'), JSON.stringify(this.data, null, '\t'))
      
    console.log('updated')

  }
}

function getCurrentRotonde(p = config.get('path')) {
  var exists = fs.existsSync(p)
  if (exists) {
    if (!fs.existsSync(path.join(p, 'dat.json'))) return false
    if (!fs.existsSync(path.join(p, 'portal.json'))) return false

    return true
  }

  return false
}