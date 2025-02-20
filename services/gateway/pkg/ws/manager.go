// pkg/ws/manager.go
package ws

import (
	"sync"

	"golang.org/x/net/websocket"
)

type Connection struct {
	Conn *websocket.Conn
	mu   sync.Mutex
}

type ConnectionManager struct {
	connections sync.Map
}

func NewConnectionManager() *ConnectionManager {
	return &ConnectionManager{}
}

func (m *ConnectionManager) Add(conn *Connection) {
	m.connections.Store(conn, struct{}{})
}

func (m *ConnectionManager) Remove(conn *Connection) {
	m.connections.Delete(conn)
}

func (m *ConnectionManager) CloseAll() {
	m.connections.Range(func(key, value interface{}) bool {
		if conn, ok := key.(*Connection); ok {
			conn.Conn.Close()
		}
		return true
	})
}
